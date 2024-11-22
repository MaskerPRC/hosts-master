class NetworkService {
  constructor() {
    this.ipcRenderer = window.require('electron').ipcRenderer;
  }

  async pingHost(host) {
    try {
      return await this.ipcRenderer.invoke('network:ping', { host });
    } catch (error) {
      console.error('Ping失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async checkDns(domain) {
    try {
      return await this.ipcRenderer.invoke('network:dns', { domain });
    } catch (error) {
      console.error('DNS解析失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async traceroute(host) {
    try {
      return await this.ipcRenderer.invoke('network:traceroute', { host });
    } catch (error) {
      console.error('路由追踪失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async httpCheck(url) {
    try {
      return await this.ipcRenderer.invoke('network:http-check', { url });
    } catch (error) {
      console.error('HTTP检查失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new NetworkService(); 