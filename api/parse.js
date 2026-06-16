const axios = require('axios');

export default async function handler(req, res) {
    // 允许前端跨域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // ==========================================
    // 🔍 移动端开放式接口：完美穿透 Vercel IP 封锁 (GET 请求)
    // ==========================================
    if (req.method === 'GET') {
        const { keywords } = req.query;
        if (!keywords) return res.status(400).json({ success: false, msg: '缺少搜索关键词' });
        
        try {
            // 使用官方移动端外部无密搜索接口（该接口对机房 IP 极其宽容，且完美支持中文与特殊符号）
            const searchUrl = `https://music.163.com/api/search/get/web?s=${encodeURIComponent(keywords.trim())}&type=1&limit=20&offset=0`;
            
            const searchRes = await axios.get(searchUrl, {
                headers: { 
                    'Referer': 'https://y.music.163.com/',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.93 Mobile Safari/537.36'
                }
            });
            
            // 提取歌曲数组
            const songs = searchRes.data?.result?.songs || [];
            
            if (songs.length === 0) {
                // 备用方案：如果上面还是没有，尝试极简移动端接口
                const backupUrl = `https://music.163.com/api/search/search/get?s=${encodeURIComponent(keywords.trim())}&type=1&limit=15`;
                const backupRes = await axios.get(backupUrl).catch(() => null);
                const backupSongs = backupRes?.data?.result?.songs || [];
                if (backupSongs.length > 0) {
                    return res.status(200).json({ success: true, data: formatSongs(backupSongs) });
                }
                return res.status(200).json({ success: true, data: [] });
            }

            return res.status(200).json({ success: true, data: formatSongs(songs) });
        } catch (error) {
            return res.status(500).json({ success: false, msg: error.message });
        }
    }

    // ==========================================
    // 🎵 原有：歌曲解析播放功能 (POST 请求)
    // ==========================================
    if (req.method === 'POST') {
        const { songId } = req.body;
        if (!songId) return res.status(400).json({ success: false, msg: '缺少歌曲 ID' });

        const WYY_COOKIE = process.env.WYY_COOKIE || ""; 

        try {
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

    return res.status(405).json({ msg: '不支持的请求方法' });
}

// 统一数据格式化函数
function formatSongs(songs) {
    return songs.map(song => {
        let artistName = '未知歌手';
        if (song.artists && song.artists.length > 0) {
            artistName = song.artists.map(a => a.name).join(', ');
        } else if (song.ar && song.ar.length > 0) {
            artistName = song.ar.map(a => a.name).join(', ');
        }
        return {
            id: song.id,
            name: song.name,
            artist: artistName,
            album: song.album?.name || song.al?.name || '未知专辑'
        };
    });
}
