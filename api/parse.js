const axios = require('axios');

export default async function handler(req, res) {
    // 允许前端跨域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // 【新增支持】因为音频流是通过 <audio src="xxx"> 发送的 GET 请求，所以必须同时支持 POST（点播）和 GET（播放音频流）
    if (req.method === 'GET') {
        const { streamId } = req.query;
        if (!streamId) return res.status(400).end('Missing streamId');

        try {
            // 这里我们使用通用的官方外链作为中转源（你可以根据需要换成 enhance 接口的直链）
            const targetAudioUrl = `https://music.163.com/song/media/outer/url?id=${streamId}.mp3`;

            // 后端代替前端去请求这个音频流
            const streamRes = await axios({
                method: 'get',
                url: targetAudioUrl,
                responseType: 'stream', // 核心：以流的形式接收
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://music.163.com/'
                }
            });

            // 保持和网易云一样的响应头，告诉浏览器这是一个音频文件
            res.setHeader('Content-Type', streamRes.headers['content-type'] || 'audio/mpeg');
            if (streamRes.headers['content-length']) {
                res.setHeader('Content-Length', streamRes.headers['content-length']);
            }
            // 支持音频进度条拖动（Accept-Ranges）
            res.setHeader('Accept-Ranges', 'bytes');

            // 管道传输：把网易云的音频流实时灌进 Vercel 的响应中，吐给前端浏览器
            streamRes.data.pipe(res);
            return;
        } catch (err) {
            console.error("音频流中转失败:", err.message);
            return res.status(500).end('Audio Stream Error');
        }
    }

    // ------------------ 原来的 POST 点播逻辑 ------------------
    if (req.method !== 'POST') return res.status(405).json({ msg: '仅支持 POST/GET 请求' });

    const { songId } = req.body;
    if (!songId) return res.status(400).json({ success: false, msg: '缺少歌曲 ID' });

    const WYY_COOKIE = process.env.WYY_COOKIE || ""; 

    try {
        // 1. 调用移动端高品质接口（仅用来判断歌曲是否存在、是否能正常解析）
        const fallbackUrl = `https://music.163.com/api/song/enhance/player/url?id=${songId}&ids=[${songId}]&br=320000`;
        const fallbackRes = await axios.get(fallbackUrl, {
            headers: {
                'Cookie': WYY_COOKIE,
                'Referer': 'https://music.163.com/',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
            }
        });
        
        let audioUrlFromWyy = fallbackRes.data?.data?.[0]?.url;
        let isVip = false;

        if (!audioUrlFromWyy || fallbackRes.data?.data?.[0]?.freeTrialInfo) {
            isVip = false;
        } else {
            isVip = true; 
        }

        // 【核心修改】前端的 audioUrl 不再传网易云直链，而是传指向我们自己这个 API 的 GET 路由
        // 这样前端 <audio> 请求播放时，会触发上面的 `if (req.method === 'GET')` 逻辑进行中转
        const myVercelUrl = req.headers.host ? `https://${req.headers.host}` : '';
        const audioUrl = `${myVercelUrl}/api/parse?streamId=${songId}`;

        // 2. 获取歌名和歌手详细信息
        const detailUrl = `https://music.163.com/api/v1/song/detail/?id=${songId}&ids=%5B${songId}%5D`;
        const detailRes = await axios.get(detailUrl).catch(() => null);
        let songName = `网易云点播_${songId}`;
        let artistName = isVip ? "后端中转高品质通道 (VIP)" : "后端安全中转通道";
        
        if (detailRes && detailRes.data && detailRes.data.songs && detailRes.data.songs[0]) {
            const songInfo = detailRes.data.songs[0];
            songName = songInfo.name;
            artistName = songInfo.ar ? songInfo.ar.map(a => a.name).join('/') : songInfo.artists.map(a => a.name).join('/');
        }

        // 3. 获取歌词
        let lyric = "";
        try {
            const lrcRes = await axios.get(`https://music.163.com/api/song/media?id=${songId}`);
            if (lrcRes.data && lrcRes.data.lyric) {
                lyric = lrcRes.data.lyric;
            }
        } catch(e) {
            console.log("歌词获取失败");
        }

        // 将专属的中转 audioUrl 传给前端
        return res.status(200).json({
            success: true,
            audioUrl,
            songName,
            artistName,
            lyric: lyric 
        });

    } catch (error) {
        return res.status(500).json({ success: false, msg: error.message });
    }
}
