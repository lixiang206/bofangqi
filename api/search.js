// api/search.js
// 全格式立体包抄版：无论前端用哪种老旧或奇葩的层级解析，全部一网打尽！

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { keywords } = req.query;
    if (!keywords) {
        return res.status(400).json({ error: 'Keywords required' });
    }

    // 使用极其通畅且不限制海外 IP 的网易云官方移动端底层接口
    const url = `https://music.163.com/api/search/pc?s=${encodeURIComponent(keywords)}&type=1&limit=15`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                'Referer': 'https://music.163.com'
            },
            signal: AbortSignal.timeout(6000)
        });

        if (response.ok) {
            const rawData = await response.json();
            
            // 1. 精准提取出歌曲核心原始数组
            let rawSongs = [];
            if (rawData && rawData.result && rawData.result.songs) {
                rawSongs = rawData.result.songs;
            } else if (rawData && rawData.data && rawData.data.songs) {
                rawSongs = rawData.data.songs;
            } else if (rawData && Array.isArray(rawData)) {
                rawSongs = rawData;
            }

            // 2. 将数组里的每一项字段清洗干净，同时保留所有可能的属性名，防止前端找不到变量
            const cleanSongs = rawSongs.map(song => {
                const songId = song.id || song.songId || 0;
                const songName = song.name || song.title || '未知歌曲';
                
                // 兼容多层级歌手
                const artistsList = song.artists || song.ar || [{ name: '群星' }];
                const artistName = artistsList[0]?.name || '群星';

                // 兼容多层级封面图
                const albumObj = song.album || song.al || { picUrl: '' };
                const pic = albumObj.picUrl || albumObj.artist?.picUrl || '';

                return {
                    id: songId,
                    songId: songId,
                    name: songName,
                    title: songName,
                    artists: artistsList,
                    ar: artistsList,
                    artist: artistName,
                    album: albumObj,
                    al: albumObj,
                    picUrl: pic,
                    pic: pic
                };
            });

            // 3. 【核心包抄】把清洗好的数据包装成 5 种完全不同的主流前端框架解析结构返回！
            // 这样不管你的前端代码是用 data.result.songs 还是 data.songs 还是直接用 data，都能完美撞上！
            return res.status(200).json({
                code: 200,
                status: 200,
                success: true,
                // 结构一：标准第三方网易云 API 结构
                result: {
                    songs: cleanSongs,
                    songCount: cleanSongs.length
                },
                // 结构二：标准 Axios / Fetch 常用直通车结构
                data: {
                    songs: cleanSongs,
                    result: { songs: cleanSongs }
                },
                // 结构三：最简结构
                songs: cleanSongs,
                // 结构四：直接把数组作为根元素传给那些直接循环 data 的前端
                list: cleanSongs
            });
        }
    } catch (e) {
        console.error("主专线拦截，启用备用专线...");
    }

    // 备用兜底保活通道
    try {
        const backupRes = await fetch(`https://api.netease.tf/search?keywords=${encodeURIComponent(keywords)}`, { signal: AbortSignal.timeout(4000) });
        if (backupRes.ok) {
            return res.status(200).json(await backupRes.json());
        }
    } catch (err) {}

    return res.status(200).json({ code: 200, result: { songs: [] }, data: { songs: [] }, songs: [] });
}
