const axios = require('axios');

export default async function handler(req, res) {
    // 允许前端跨域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // ------------------ 【新增】GET 请求：实时中转高品质音频流 ------------------
    if (req.method === 'GET') {
        const { sourceUrl } = req.query;
        if (!sourceUrl) return res.status(400).end('Missing sourceUrl');

        try {
            // 解码前端传过来的真实网易云高品质直链
            const targetAudioUrl = decodeURIComponent(sourceUrl);

            // 后端（海外/Vercel环境）代替国内前端去拉取这个高品质音频流
            const streamRes = await axios({
                method: 'get',
                url: targetAudioUrl,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://music.163.com/'
                },
                timeout: 10000 // 10秒超时控制
            });

            // 保持标准的音频流响应头，支持浏览器进度条拖动
            res.setHeader('Content-Type', streamRes.headers['content-type'] || 'audio/mpeg');
            if (streamRes.headers['content-length']) {
                res.setHeader('Content-Length', streamRes.headers['content-length']);
            }
            res.setHeader('Accept-Ranges', 'bytes');

            // 管道传输：把高品质音频流实时灌回给国内的前端浏览器
            streamRes.data.pipe(res);
            return;
        } catch (err) {
            console.error("高品质音频流中转失败:", err.message);
            return res.status(500).end('Audio Stream Proxy Error');
        }
    }

    // ------------------ 【保持+优化】POST 请求：通过 Cookie 正常解析 ------------------
    if (req.method !== 'POST') return res.status(405).json({ msg: '仅支持 POST/GET 请求' });

    const { songId } = req.body;
    if (!songId) return res.status(400).json({ success: false, msg: '缺少歌曲 ID' });

    const WYY_COOKIE = process.env.WYY_COOKIE || ""; 

    try {
        // 1. 严格使用你原本的移动端高品质接口和环境变量 Cookie 获取播放直链
        const fallbackUrl = `https://music.163.com/api/song/enhance/player/url?id=${songId}&ids=[${songId}]&br=320000`;
        const fallbackRes = await axios.get(fallbackUrl, {
            headers: {
                'Cookie': WYY_COOKIE,
                'Referer': 'https://music.163.com/',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
            }
        });
        
        let realWyyUrl = fallbackRes.data?.data?.[0]?.url;
        let isVip = false;

        if (!realWyyUrl || fallbackRes.data?.data?.[0]?.freeTrialInfo) {
            // 如果 Cookie 失效或者非 VIP 歌，走原兜底外链
            realWyyUrl = `https://music.163.com/song/media/outer/url?id=${songId}.mp3`;
            isVip = false;
        } else {
            isVip = true; 
        }

        // 【核心改造】在这里将拿到的高品质直链进行编码，包装成指向我们自己 API 的中转路由
        const myVercelUrl = req.headers.host ? `https://${req.headers.host}` : '';
        const audioUrl = `${myVercelUrl}/api/parse?sourceUrl=${encodeURIComponent(realWyyUrl)}`;

        // 2. 获取歌名和歌手详细信息（保持原样）
        const detailUrl = `https://music.163.com/api/v1/song/detail/?id=${songId}&ids=%5B${songId}%5D`;
        const detailRes = await axios.get(detailUrl).catch(() => null);
        let songName = `网易云点播_${songId}`;
        let artistName = isVip ? "云端高品质通道 (VIP)" : "官方通用直连通道";
        
        if (detailRes && detailRes.data && detailRes.data.songs && detailRes.data.songs[0]) {
            const songInfo = detailRes.data.songs[0];
            songName = songInfo.name;
            artistName = songInfo.ar ? songInfo.ar.map(a => a.name).join('/') : songInfo.artists.map(a => a.name).join('/');
        }

        // 3. 获取歌词（保持原样）
        let lyric = "";
        try {
            const lrcRes = await axios.get(`https://music.163.com/api/song/media?id=${songId}`);
            if (lrcRes.data && lrcRes.data.lyric) {
                lyric = lrcRes.data.lyric;
            }
        } catch(e) {
            console.log("歌词获取失败");
        }

        // 返回包含中转音频链接的 JSON 数据
        return res.status(200).json({
            success: true,
            audioUrl, // 此时的 audioUrl 已经是走你的 Vercel 中转的无墙链接了
            songName,
            artistName,
            lyric: lyric 
        });

    } catch (error) {
        return res.status(500).json({ success: false, msg: error.message });
    }
}
