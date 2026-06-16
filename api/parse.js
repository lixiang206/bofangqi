const axios = require('axios');

export default async function handler(req, res) {
    // 允许前端跨域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // ==========================================
    // 🔍 终极强化版：完美支持中文、特殊符号的歌曲搜索 (GET 请求)
    // ==========================================
    if (req.method === 'GET') {
        const { keywords } = req.query;
        if (!keywords) return res.status(400).json({ success: false, msg: '缺少搜索关键词' });
        
        try {
            // 对关键词进行标准的二次清洗和重新编码，防止中文和特殊符号（如空格、#、&等）导致URL断裂
            const cleanedKeywords = encodeURIComponent(keywords.trim());
            
            // 使用对高频词、特殊符号和中文字符集最包容的移动端核心搜索接口
            const searchUrl = `https://music.163.com/api/search/get/web?s=${cleanedKeywords}&type=1&limit=20&offset=0`;
            
            const searchRes = await axios.get(searchUrl, {
                headers: { 
                    'Referer': 'https://music.163.com/search/',
                    'Host': 'music.163.com',
                    'Origin': 'https://music.163.com',
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
                }
            });
            
            // 兼容网易云各种奇葩的返回外壳结构
            const resultData = searchRes.data?.result || searchRes.data?.data || {};
            const songs = resultData.songs || [];
            
            if (songs.length === 0) {
                return res.status(200).json({ success: true, data: [] });
            }

            // 精准解析带中文和特殊符号的歌曲名、歌手名
            const resultList = songs.map(song => {
                // 处理歌手名字（兼容多位歌手用逗号隔开）
                let artistName = '未知歌手';
                if (song.artists && song.artists.length > 0) {
                    artistName = song.artists.map(a => a.name).join(', ');
                } else if (song.ar && song.ar.length > 0) {
                    artistName = song.ar.map(a => a.name).join(', ');
                }

                return {
                    id: song.id,
                    name: song.name, // 包含中文和特殊符号的完整歌名
                    artist: artistName,
                    album: song.album?.name || song.al?.name || '未知专辑'
                };
            });
            
            return res.status(200).json({ success: true, data: resultList });
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
