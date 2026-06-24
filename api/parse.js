const axios = require('axios');

export default async function handler(req, res) {
    // 允许前端跨域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const WYY_COOKIE = process.env.WYY_COOKIE || ""; 
    const COMMON_HEADERS = {
        'Cookie': WYY_COOKIE,
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
    };

    // ==========================================
    // 1. 【新增 GET 逻辑】音频流云端中转代理通道
    // 前端直接将 <audio src="你的API地址?streamId=xxx"> 挂载即可播放
    // ==========================================
    if (req.method === 'GET') {
        const { streamId } = req.query;
        if (!streamId) return res.status(400).end('Missing streamId');

        try {
            // 先尝试获取高品质 VIP 地址
            const playUrlApi = `https://music.163.com/api/song/enhance/player/url?id=${streamId}&ids=[${streamId}]&br=320000`;
            const playRes = await axios.get(playUrlApi, { headers: COMMON_HEADERS });
            let realAudioUrl = playRes.data?.data?.[0]?.url;

            // 如果没有或者触发试听标记，则采用官方移动端通用分流
            if (!realAudioUrl || playRes.data?.data?.[0]?.freeTrialInfo) {
                realAudioUrl = `https://interface.music.163.com/eapi/song/enhance/player/url?id=${streamId}&ids=[${streamId}]&br=128000`;
            }

            // 如果上面都拿不到，则用最硬核的无 cookie 直连尝试
            if (!realAudioUrl) {
                realAudioUrl = `http://music.163.com/song/media/outer/url?id=${streamId}.mp3`;
            }

            // 强行把网易云返回的 http 协议修复为 https 规避混合内容拦截
            if (realAudioUrl.startsWith('http://')) {
                realAudioUrl = realAudioUrl.replace('http://', 'https://');
            }

            // 核心：使用 axios 以流的形式拉取网易云音乐原始数据，并实时转发给前端
            const audioStream = await axios({
                method: 'get',
                url: realAudioUrl,
                responseType: 'stream',
                headers: { 'User-Agent': COMMON_HEADERS['User-Agent'] }
            });

            res.setHeader('Content-Type', 'audio/mpeg');
            audioStream.data.pipe(res);
        } catch (err) {
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
            const detailRes = await axios.get(detailUrl).catch(() => null);
            let songName = `网易云点播_${songId}`;
            let artistName = "网易云音乐";
            
            if (detailRes?.data?.songs?.[0]) {
                songName = detailRes.data.songs[0].name;
                artistName = detailRes.data.songs[0].ar.map(a => a.name).join(', ');
            }

            // 云端请求歌词
            const lyricUrl = `https://music.163.com/api/song/lyric?id=${songId}&lv=1&kv=1&tv=-1`;
            const lyricRes = await axios.get(lyricUrl).catch(() => null);
            let lyricText = "";

            if (lyricRes?.data?.lrc?.lyric) {
                lyricText = lyricRes.data.lrc.lyric;
            } else if (lyricRes?.data?.uncons) {
                lyricText = "[00:00.00] 纯音乐，请享受旋律 ~";
            } else {
                lyricText = "[00:00.00] 暂无歌词数据";
            }

            // 关键改动：audioUrl 直接指向你自己的这个 API 路由，带上流式参数
            const proxyAudioUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/parse?streamId=${songId}`;

            return res.status(200).json({
                success: true,
                songName: songName,
                artistName: artistName,
                audioUrl: proxyAudioUrl, // 👈 扔给你自己的后端处理
                lyric: lyricText
            });
        } catch (error) {
            return res.status(500).json({ success: false, msg: error.message });
        }
    }
}
