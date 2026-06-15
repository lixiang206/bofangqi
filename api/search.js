// ========================================================
// 椎名真昼主题音乐盒 - 核心网络请求配置文件 (search.js)
// ========================================================

// 【核心配置】将基础路径指向你通过 localtunnel 穿透成功的本地网易云 API 地址
const BASE_URL = "https://hip-gifts-drop.loca.lt";

/**
 * 歌曲搜索函数
 * @param {string} keyword - 用户输入的搜索关键词（如：恭喜发财、叹云兮）
 * @returns {Promise<object>} - 返回包含歌曲列表的解析对象
 */
async function searchMusic(keyword) {
    if (!keyword || keyword.trim() === "") {
        alert("请输入歌曲名或歌手名！");
        return null;
    }
    
    try {
        // 使用 cloudsearch 接口，直连本地穿透地址，并对关键词进行编码防止乱码
        const url = `${BASE_URL}/cloudsearch?keywords=${encodeURIComponent(keyword.trim())}`;
        console.log("正在请求搜索接口:", url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`网络请求失败，状态码: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("=== 椎名真昼音乐盒收到的网络原始数据 ===", data);
        
        // 兼容原项目的数据结构返回
        return data;
    } catch (error) {
        console.error("搜索歌曲时发生错误:", error);
        alert("搜索失败，请确保本地 API 窗口与穿透工具未关闭，且已手动激活过通道！");
        return null;
    }
}

/**
 * 歌词获取函数
 * @param {number|string} id - 歌曲的网易云歌曲 ID
 * @returns {Promise<string>} - 返回经过解析后的标准歌词文本
 */
async function fetchLrc(id) {
    if (!id) return "[00:00.00] 暂无当前歌曲ID";
    
    try {
        // 直连本地网易云 API 的歌词接口 /lyric
        const url = `${BASE_URL}/lyric?id=${id}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`歌词请求失败，状态码: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 解析并返回标准歌词
        if (data.lrc && data.lrc.lyric) {
            return data.lrc.lyric;
        } else {
            return "[00:00.00] 纯音乐，请欣赏";
        }
    } catch (error) {
        console.error("获取歌词失败:", error);
        return "[00:00.00] 歌词加载失败";
    }
}

// 将封装好的方法挂载到全局 window 对象上，确保主脚本能够正常调用
window.searchMusic = searchMusic;
window.fetchLrc = fetchLrc;
