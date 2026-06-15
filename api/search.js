// ========================================================
// 椎名真昼主题音乐盒 - 核心网络请求配置文件 (search.js)
// ========================================================

// 1. 定义本地网易云 API 穿透到公网的最新地址
const BASE_URL = "https://hip-gifts-drop.loca.lt";

/**
 * 歌曲搜索函数
 * @param {string} keyword - 用户输入的搜索关键词
 * @returns {Promise<object>} - 返回歌曲列表数据
 */
async function searchMusic(keyword) {
    if (!keyword) {
        alert("请输入歌曲名或歌手名！");
        return null;
    }
    
    try {
        // 使用 cloudsearch 接口，直连本地穿透地址，并对关键词进行编码防止乱码
        const response = await fetch(`${BASE_URL}/cloudsearch?keywords=${encodeURIComponent(keyword)}`);
        
        if (!response.ok) {
            throw new Error(`网络请求失败，状态码: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("=== 椎名真昼音乐盒收到的网络原始数据 ===", data);
        return data;
    } catch (error) {
        console.error("搜索歌曲时发生错误:", error);
        alert("搜索失败，请确保本地 API 窗口与穿透工具未关闭！");
        return null;
    }
}

/**
 * 歌词获取函数
 * @param {number|string} id - 歌曲的网易云 ID
 * @returns {Promise<string>} - 返回经过解析后的歌词文本
 */
async function fetchLrc(id) {
    if (!id) return "[00:00.00] 暂无当前歌曲ID";
    
    try {
        // 直连本地网易云 API 的歌词接口
        const response = await fetch(`${BASE_URL}/lyric?id=${id}`);
        
        if (!response.ok) {
            throw new Error(`歌词请求失败，状态码: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 解析返回的歌词数据
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

// 将封装好的方法暴露给全局，供 index.html 或 main.js 调用
window.searchMusic = searchMusic;
window.fetchLrc = fetchLrc;
