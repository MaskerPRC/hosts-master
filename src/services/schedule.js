class ScheduleService {
  constructor() {
    this.ipcRenderer = window.require('electron').ipcRenderer;
  }

  async addSchedule(config) {
    try {
      return await this.ipcRenderer.invoke('schedule:add', config);
    } catch (error) {
      console.error('添加定时任务失败:', error);
      throw error;
    }
  }

  async removeSchedule(scheduleId) {
    try {
      return await this.ipcRenderer.invoke('schedule:remove', { scheduleId });
    } catch (error) {
      console.error('删除定时任务失败:', error);
      throw error;
    }
  }

  async getSchedules() {
    try {
      return await this.ipcRenderer.invoke('schedule:get-all');
    } catch (error) {
      console.error('获取定时任务列表失败:', error);
      return [];
    }
  }

  async getActiveSchedules() {
    try {
      return await this.ipcRenderer.invoke('schedule:get-active');
    } catch (error) {
      console.error('获取活动定时任务失败:', error);
      return [];
    }
  }
}

export default new ScheduleService(); 