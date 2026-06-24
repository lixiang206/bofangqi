const axios = require('axios');

export default async function handler(req, res) {
    // 允许前端跨域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ msg: '仅支持 POST 请求' });

    const { songId } = req.body;
    if (!songId) return res.status(400).json({ success: false, msg: '缺少歌曲 ID' });

    const WYY_COOKIE = process.env.WYY_COOKIE || ""; 

    try {
        // 1. 调用移动端高品质接口获取播放直链
        const fallbackUrl = `https://music.163.com/api/song/enhance/player/url?id=${songId}&ids=[${songId}]&br=320000`;
        const fallbackRes = await axios.get(fallbackUrl, {
            headers: {
                'Cookie': WYY_COOKIE,
                'Referer': 'https://music.163.com/',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
            }
        });
        
        let audioUrl = fallbackRes.data?.data?.[0]?.url;
        let isVip = false;

        if (!audioUrl || fallbackRes.data?.data?.[0]?.freeTrialInfo) {
            audioUrl = `https://music.163.com/song/media/outer/url?id=${songId}.mp3`;
        } else {
            isVip = true; 
        }

        // 2. 获取歌名和歌手详细信息
        const detailUrl = `https://music.163.com/api/v1/song/detail/?id=${songId}&ids=%5B${songId}%5D`;
        const detailRes = await axios.get(detailUrl).catch(() => null);
        let songName = `网易云点播_${songId}`;
        let artistName = isVip ? "云端高品质通道 (VIP)" : "官方通用直连通道";
        
        if (detailRes && detailRes.data && detailRes.data.songs && detailRes.data.songs[0]) {
            const songInfo = detailRes.data.songs[0];
            songName = songInfo.name;
            artistName = songInfo.ar ? songInfo.ar.map(a => a.name).join('/') : songInfo.artists.map(a => a.name).join('/');
        }

        // 3. 【新增】在后端顺便获取歌词，彻底避免前端跨域问题
        let lyric = "";
        try {
            const lrcRes = await axios.get(`https://music.163.com/api/song/media?id=${songId}`);
            if (lrcRes.data && lrcRes.data.lyric) {
                lyric = lrcRes.data.lyric;
            }
        } catch(e) {
            console.log("歌词获取失败");
        }

        // 将歌词 (lyric) 一并返回给前端
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
