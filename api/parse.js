const axios = require('axios');

export default async function handler(req, res) {
    // 允许前端跨域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const WYY_COOKIE = process.env.WYY_COOKIE || ""; 
    const COMMON_HEADERS = {
        'Cookie': WYY_COOKIE,
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
    };

    // ==========================================
    // 1. 【GET 逻辑】音频流云端中转代理通道
    // ==========================================
    if (req.method === 'GET') {
        const { streamId } = req.query;
        if (!streamId) return res.status(400).end('Missing streamId');

        try {
            let realAudioUrl = "";

            // 【第一通道】尝试获取高品质/VIP 地址
            try {
                const playUrlApi = `https://music.163.com/api/song/enhance/player/url?id=${streamId}&ids=[${streamId}]&br=320000`;
                const playRes = await axios.get(playUrlApi, { headers: COMMON_HEADERS, timeout: 4000 });
                const songData = playRes.data?.data?.[0];
                
                // 确保链接存在，且不是只有限时试听的 VIP 残缺音频
                if (songData?.url && !songData?.freeTrialInfo) {
                    realAudioUrl = songData.url;
                }
            } catch (e) {
                console.error("第一通道解析失败，切换备用通道");
            }

            // 【第二通道】保底硬核外链（注意：此官方外链严禁改为 https，必须保持 http 才能畅通访问）
            if (!realAudioUrl) {
                realAudioUrl = `http://music.163.com/song/media/outer/url?id=${streamId}.mp3`;
            }

            // 核心：使用 axios 拉取网易云音乐原始流
            // 注意：maxRedirects: 5 配合 beforeRedirect 可以完美解决网易云 302 重定向丢失 Headers 的防盗链问题
            const audioStream = await axios({
                method: 'get',
                url: realAudioUrl,
                responseType: 'stream',
                maxRedirects: 5,
                headers: COMMON_HEADERS, // 带上完整的伪装头，防止被网易云 CDN 拦截
                beforeRedirect: (options) => {
                    // 确保重定向到 126.net 域名时，依然保留网易云的防盗链伪装 Headers
                    options.headers = COMMON_HEADERS;
                },
                timeout: 10000 // 10秒超时控制
            });

            // 转发音频流响应头
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Accept-Ranges', 'bytes'); // 允许前端快进/拖动进度条
            
            // 将网易云流实时管道式输出给前端
            audioStream.data.pipe(res);
        } catch (err) {
            console.error("流式代理发生错误:", err.message);
            return res.status(500).end('Audio Stream Proxy Error');
        }
        return;
    }

    // ==========================================
    // 2. 【POST 逻辑】处理歌曲元数据与歌词解析
    // ==========================================
    if (req.method === 'POST') {
        const { songId } = req.body;
        if (!songId) return res.status(400).json({ success: false, msg: '缺少歌曲 ID' });

        try {
            // 云端获取歌名与歌手信息
            const detailUrl = `https://music.163.com/api/v1/song/detail/?id=${songId}&ids=%5B${songId}%5D`;
            const detailRes = await axios.get(detailUrl, { headers: COMMON_HEADERS }).catch(() => null);
            let songName = `网易云点播_${songId}`;
            let artistName = "网易云音乐";
            
            if (detailRes?.data?.songs?.[0]) {
                songName = detailRes.data.songs[0].name;
                artistName = detailRes.data.songs[0].ar.map(a => a.name).join(', ');
            }

            // 云端请求歌词
            const lyricUrl = `https://music.163.com/api/song/lyric?id=${songId}&lv=1&kv=1&tv=-1`;
            const lyricRes = await axios.get(lyricUrl, { headers: COMMON_HEADERS }).catch(() => null);
            let lyricText = "";

            if (lyricRes?.data?.lrc?.lyric) {
                lyricText = lyricRes.data.lrc.lyric;
            } else if (lyricRes?.data?.uncons) {
                lyricText = "[00:00.00] 纯音乐，请享受旋律 ~";
            } else {
                lyricText = "[00:00.00] 暂无歌词数据";
            }

            // 动态生成前端访问你当前 API 的 GET 流链接
            const proxyAudioUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/parse?streamId=${songId}`;

            return res.status(200).json({
                success: true,
                songName: songName,
                artistName: artistName,
                audioUrl: proxyAudioUrl, 
                lyric: lyricText
            });
        } catch (error) {
            return res.status(500).json({ success: false, msg: error.message });
        }
    }
}
