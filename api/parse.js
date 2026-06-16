const axios = require('axios');

export default async function handler(req, res) {
    // 允许前端跨域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ msg: '仅支持 POST 请求' });

    const { songId } = req.body;
    if (!songId) return res.status(400).json({ success: false, msg: '缺少歌曲 ID' });

    // ==========================================
    // 🔒 安全设计：直接从 Vercel 环境变量中读取你的 Cookie
    // 这样不用把长长的 Cookie 暴露在公开代码里，更加安全！
    // ==========================================
    const WYY_COOKIE = process.env.WYY_COOKIE || ""; 

    try {
        // 调用移动端高品质接口获取包含你账号 VIP 权限的直链
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

        // 如果获取到了歌，且带有试听标记（说明这个Cookie失效了或者非VIP看不了完整版），进行通用直连兜底
        if (!audioUrl || fallbackRes.data?.data?.[0]?.freeTrialInfo) {
            audioUrl = `https://music.163.com/song/media/outer/url?id=${songId}.mp3`;
        } else {
            isVip = true; 
        }

        // 云端简单模拟一下获取歌名
        const detailUrl = `https://music.163.com/api/v1/song/detail/?id=${songId}&ids=%5B${songId}%5D`;
        const detailRes = await axios.get(detailUrl).catch(() => null);
        let songName = `网易云点播_${songId}`;
        let artistName = isVip ? "云端高品质通道 (VIP)" : "官方通用直连通道";
        if (detailRes?.data?.songs?.[0]) {
            songName = detailRes.data.songs[0].name;
            artistName = detailRes.data.songs[0].ar.map(a => a.name).join(', ') + (isVip ? " [VIP]" : "");
        }

        return res.status(200).json({
            success: true,
            songName: songName,
            artistName: artistName,
            audioUrl: audioUrl 
        });
    } catch (error) {
        return res.status(500).json({ success: false, msg: error.message });
    }
}
