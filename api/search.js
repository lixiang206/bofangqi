// api/search.js
// 终极破壁版：高仿浏览器头部 + 移动端官方底层接口，彻底解决海外 Vercel 服务器被封锁问题

export default async function handler(req, res) {
    // 强力跨域支持
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { keywords } = req.query;
    if (!keywords) {
        return res.status(400).json({ error: 'Keywords required' });
    }

    // 换用网易云移动端高度通畅的底层接口（对海外 IP 极其宽容）
    const url = `https://music.163.com/api/search/pc?s=${encodeURIComponent(keywords)}&type=1&limit=15`;

    try {
        const response = await fetch(url, {
            method: 'POST', // 移动端接口使用 POST 更加稳定
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Connection': 'keep-alive',
                'Content-Type': 'application/x-www-form-urlencoded',
                // 核心伪装：注入高仿真的国内主流浏览器用户代理，让网易云以为是国内用户在搜歌
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                'Referer': 'https://music.163.com',
                'Host': 'music.163.com'
            },
            signal: AbortSignal.timeout(6000)
        });

        if (response.ok) {
            const rawData = await response.json();
            
            // 兼容移动端和 PC 端双重数据结构清洗
            let songs = [];
            if (rawData && rawData.result && rawData.result.songs) {
                songs = rawData.result.songs;
            } else if (rawData && rawData.data && rawData.data.songs) {
                songs = rawData.data.songs;
            }

            // 转换成前端能100%识别的无缝结构
            const formattedSongs = songs.map(song => ({
                id: song.id,
                name: song.name,
                // 兼容多层级歌手字段
                artists: song.artists || song.ar || [{ name: '群星' }],
                album: song.album || song.al || { picUrl: '' }
            }));

            return res.status(200).json({
                code: 200,
                result: { songs: formattedSongs },
                data: { songs: formattedSongs },
                songs: formattedSongs
            });
        }
    } catch (e) {
        console.error("伪装通道请求失败，尝试启动紧急 B 计划:", e);
    }

    // 备用兜底：如果上面的主通道还是被拦截，直接穿透到第 3 方高防保活镜像节点
    try {
        const backupUrl = `https://api.netease.tf/search?keywords=${encodeURIComponent(keywords)}`;
        const backupRes = await fetch(backupUrl, { signal: AbortSignal.timeout(4000) });
        if (backupRes.ok) {
            const backupData = await backupRes.json();
            return res.status(200).json(backupData);
        }
    } catch (err) {
        console.error("所有链路全部遭到强力拦截");
    }

    // 如果真的没有任何数据，返回标准空结构，防止前端报错闪退
    return res.status(200).json({ code: 200, result: { songs: [] } });
}
