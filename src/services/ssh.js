const { NodeSSH } = require('node-ssh');

class SSHService {
  constructor() {
    this.ssh = new NodeSSH();
    this.connected = false;
    this.config = null;
  }

  async connect(config) {
    if (!this.connected) {
      try {
        await this.ssh.connect(config);
        this.connected = true;
        this.config = config;
      } catch (error) {
        console.error('SSH 连接失败:', error);
        throw error;
      }
    }
  }

  async disconnect() {
    if (this.connected) {
      this.ssh.dispose();
      this.connected = false;
    }
  }

  async readRemoteHosts(filePath) {
    try {
      await this.connect(this.config);
      const contents = await this.ssh.getFile(filePath, null, { encoding: 'utf8' });
      return contents;
    } catch (error) {
      console.error('读取远程 hosts 文件失败:', error);
      throw error;
    }
  }

  async writeRemoteHosts(filePath, content) {
    try {
      await this.connect(this.config);
      await this.ssh.putFile(Buffer.from(content), filePath);
      return true;
    } catch (error) {
      console.error('写入远程 hosts 文件失败:', error);
      throw error;
    }
  }

  async setConfig(config) {
    this.config = config;
  }
}

export default new SSHService(); 