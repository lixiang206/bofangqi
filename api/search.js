// api/search.js
// 终极全字段穿透版：完美适配前端对官方接口的数据解析结构

export default async function handler(req, res) {
    // 强力跨域支持
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const { keywords } = req.query;
    if (!keywords) {
        return res.status(400).json({ error: 'Keywords required' });
    }

    // 官方高可用原生检索通道
    const url = `https://music.163.com/api/search/get/web?s=${encodeURIComponent(keywords)}&type=1&limit=15`;

    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (response.ok) {
            const rawData = await response.json();
            
            // 为了防止前端代码在解析层出现任何兼容差错
            // 我们同时返回带有【result】层级和不带层级的两种双保险结构
            if (rawData && rawData.result) {
                return res.status(200).json({
                    code: 200,
                    result: rawData.result,          // 穿透标准结构
                    data: rawData.result.songs || [], // 穿透直通车结构
                    songs: rawData.result.songs || [] // 穿透最简结构
                });
            }
        }
    } catch (e) {
        console.error("官方骨干网调度异常:", e);
    }

    // 如果接口异常或无数据，给前端返回一个标准的空数组结构，避免其挂掉
    return res.status(200).json({ code: 200, result: { songs: [] }, data: [], songs: [] });
}
