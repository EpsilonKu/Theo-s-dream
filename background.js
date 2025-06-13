// Background service worker for Theo's dream Extension

class BackgroundService {
  constructor() {
    this.init();
  }

  init() {
    // Listen for extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details);
    });

    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Listen for tab updates to inject content script if needed
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });
  }

  handleInstallation(details) {
    if (details.reason === 'install') {
      // Set default settings on first install
      this.setDefaultSettings();
      
      // Open welcome page
      chrome.tabs.create({
        url: chrome.runtime.getURL('options.html')
      });
    }
  }

  async setDefaultSettings() {
    const defaultSettings = {
      targetChannels: [],
      enabled: true,
      videoLengthThreshold: 10, // minutes
      shortsEnabled: true,
      videoAutoPlayEnabled: true,
      autoPlayVideoUrl: 'https://www.youtube.com/watch?v=zZ7AimPACzc'
    };

    try {
      await chrome.storage.sync.set(defaultSettings);
      console.log('Default settings saved');
    } catch (error) {
      console.error('Error saving default settings:', error);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'openOptions':
        await this.openOptionsPage();
        sendResponse({ success: true });
        break;
        
      case 'getSettings':
        const settings = await this.getSettings();
        sendResponse({ settings });
        break;
        
      case 'saveSettings':
        await this.saveSettings(message.settings);
        sendResponse({ success: true });
        break;
        
      case 'fetchShortsVideos':
        const videos = await this.fetchShortsVideos(message.query);
        sendResponse({ videos });
        break;
        
      default:
        sendResponse({ error: 'Unknown action' });
    }
  }

  async openOptionsPage() {
    try {
      const tabs = await chrome.tabs.query({ 
        url: chrome.runtime.getURL('options.html') 
      });
      
      if (tabs.length > 0) {
        // Focus existing options tab
        await chrome.tabs.update(tabs[0].id, { active: true });
        await chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        // Create new options tab
        await chrome.tabs.create({
          url: chrome.runtime.getURL('options.html')
        });
      }
    } catch (error) {
      console.error('Error opening options page:', error);
    }
  }

  async getSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'targetChannels',
        'enabled', 
        'videoLengthThreshold'
      ]);
      
      return {
        targetChannels: result.targetChannels,
        enabled: result.enabled !== false, // default to true
        videoLengthThreshold: result.videoLengthThreshold || 10
      };
    } catch (error) {
      console.error('Error getting settings:', error);
      return {
        targetChannels: ['Theo - t3․gg',],
        enabled: true,
        videoLengthThreshold: 10
      };
    }
  }

  async saveSettings(settings) {
    try {
      await chrome.storage.sync.set(settings);
      console.log('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  async fetchShortsVideos(query = '') {
    // In a real implementation, you would use YouTube Data API
    // For demo purposes, returning sample data
    const sampleVideos = [
      {
        id: 'dQw4w9WgXcQ',
        title: 'Amazing Short Video #1',
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        channel: 'Sample Channel',
        views: '1.2M'
      },
      {
        id: 'oHg5SJYRHA0',
        title: 'Funny Moments Compilation',
        thumbnail: 'https://img.youtube.com/vi/oHg5SJYRHA0/maxresdefault.jpg',
        channel: 'Comedy Central',
        views: '856K'
      },
      {
        id: 'iik25wqIuFo',
        title: 'Quick Tutorial',
        thumbnail: 'https://img.youtube.com/vi/iik25wqIuFo/maxresdefault.jpg',
        channel: 'Tech Tips',
        views: '2.1M'
      },
      {
        id: 'M7lc1UVf-VE',
        title: 'Epic Fail Compilation',
        thumbnail: 'https://img.youtube.com/vi/M7lc1UVf-VE/maxresdefault.jpg',
        channel: 'Fail Army',
        views: '3.4M'
      },
      {
        id: 'ZZ5LpwO-An4',
        title: 'Life Hack You Need',
        thumbnail: 'https://img.youtube.com/vi/ZZ5LpwO-An4/maxresdefault.jpg',
        channel: 'Life Hacks',
        views: '987K'
      }
    ];

    // Shuffle and return random 3-4 videos
    const shuffled = sampleVideos.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.floor(Math.random() * 2) + 3);
  }

  handleTabUpdate(tabId, changeInfo, tab) {
    // Inject content script when YouTube page loads
    if (changeInfo.status === 'complete' && 
        tab.url && 
        tab.url.includes('youtube.com/watch')) {
      
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).catch(error => {
        // Script might already be injected, ignore error
        console.log('Content script injection skipped:', error.message);
      });
    }
  }
}

// Initialize background service
new BackgroundService();