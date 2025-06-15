// Options page JavaScript for Theo's dream Extension

class OptionsManager {
  constructor() {
    this.settings = {
      targetChannels: [],
      videoLengthThreshold: 10,
      shortsEnabled: true,
      videoAutoPlayEnabled: true,
      autoPlayVideoUrl: 'https://www.youtube.com/watch?v=zZ7AimPACzc'
    };
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.renderUI();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'targetChannels', 
        'videoLengthThreshold',
        'shortsEnabled',
        'videoAutoPlayEnabled',
        'autoPlayVideoUrl'
      ]);
      
      this.settings = {
        targetChannels: result.targetChannels || ['Theo - t3․gg','ThePrimeTime'],
        videoLengthThreshold: result.videoLengthThreshold || 10,
        shortsEnabled: result.shortsEnabled !== false,
        videoAutoPlayEnabled: result.videoAutoPlayEnabled !== false,
        autoPlayVideoUrl: result.autoPlayVideoUrl || 'https://www.youtube.com/watch?v=zZ7AimPACzc'
      };
    } catch (error) {
      console.error('Error loading settings:', error);
      this.showStatus('Error loading settings', 'error');
    }
  }

  setupEventListeners() {
    // Shorts toggle
    const shortsToggle = document.getElementById('shortsToggle');
    shortsToggle.addEventListener('click', () => {
      this.settings.shortsEnabled = !this.settings.shortsEnabled;
      this.updateToggles();
    });

    // Video auto-play toggle
    const videoAutoPlayToggle = document.getElementById('videoAutoPlayToggle');
    videoAutoPlayToggle.addEventListener('click', () => {
      this.settings.videoAutoPlayEnabled = !this.settings.videoAutoPlayEnabled;
      this.updateToggles();
    });

    // Auto-play video URL input
    const autoPlayVideoUrl = document.getElementById('autoPlayVideoUrl');
    autoPlayVideoUrl.addEventListener('input', (e) => {
      this.settings.autoPlayVideoUrl = e.target.value;
    });

    // Length threshold slider
    const lengthSlider = document.getElementById('lengthSlider');
    lengthSlider.addEventListener('input', (e) => {
      this.settings.videoLengthThreshold = parseInt(e.target.value);
      this.updateLengthValue();
    });

    // Add channel button
    const addChannelBtn = document.getElementById('addChannelBtn');
    addChannelBtn.addEventListener('click', () => {
      this.addChannel();
    });

    // Save settings button
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.addEventListener('click', () => {
      this.saveSettings();
    });

    // Reset settings button
    const resetBtn = document.getElementById('resetBtn');
    resetBtn.addEventListener('click', () => {
      this.resetSettings();
    });
  }

  renderUI() {
    this.updateToggles();
    this.renderChannels();
    this.updateSliders();
    this.updateVideoUrl();
  }

  updateToggles() {
    const shortsToggle = document.getElementById('shortsToggle');
    shortsToggle.classList.toggle('active', this.settings.shortsEnabled);
    
    const videoAutoPlayToggle = document.getElementById('videoAutoPlayToggle');
    videoAutoPlayToggle.classList.toggle('active', this.settings.videoAutoPlayEnabled);
  }

  updateVideoUrl() {
    const autoPlayVideoUrl = document.getElementById('autoPlayVideoUrl');
    autoPlayVideoUrl.value = this.settings.autoPlayVideoUrl;
  }

  renderChannels() {
    const channelsList = document.getElementById('channelsList');
    channelsList.innerHTML = '';
    console.log ('targetChannels', this.settings.targetChannels)

    this.settings.targetChannels.forEach((channel, index) => {
      const channelItem = this.createChannelItem(channel, index);
      channelsList.appendChild(channelItem);
    });
  }

  createChannelItem(channel, index) {
    const div = document.createElement('div');
    div.className = 'channel-item';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = channel;
    input.placeholder = 'Channel name';
    input.addEventListener('change', (e) => {
      this.updateChannel(index, e.target.value);
    });
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      this.removeChannel(index);
    });
    
    div.appendChild(input);
    div.appendChild(removeBtn);
    
    return div;
  }

  updateChannel(index, value) {
    if (value.trim()) {
      const trimmedValue = value.trim();
      // Prevent adding "TJ DeVries" (case-insensitive)
      if (trimmedValue.toLowerCase() === 'tj devries') {
        alert('"TJ DeVries" cannot be added to the channels list.');
        // Reset to previous value or remove if it was empty
        if (this.settings.targetChannels[index]) {
          this.renderChannels();
        } else {
          this.settings.targetChannels.splice(index, 1);
          this.renderChannels();
        }
        return;
      }
      this.settings.targetChannels[index] = trimmedValue;
    } else {
      // If empty, remove the channel
      this.settings.targetChannels.splice(index, 1);
      this.renderChannels();
    }
  }

  removeChannel(index) {
    this.settings.targetChannels.splice(index, 1);
    this.renderChannels();
  }

  addChannel(channelName = '') {
    // Prevent adding "TJ DeVries" (case-insensitive)
    if (channelName.trim().toLowerCase() === 'tj devries') {
      alert('"TJ DeVries" cannot be added to the channels list.');
      return;
    }
    this.settings.targetChannels.push(channelName);
    this.renderChannels();
    
    // Focus on the new input
    setTimeout(() => {
      const inputs = document.querySelectorAll('.channel-item input');
      const lastInput = inputs[inputs.length - 1];
      if (lastInput) {
        lastInput.focus();
        lastInput.select();
      }
    }, 100);
  }

  updateSliders() {
    const lengthSlider = document.getElementById('lengthSlider');
    
    lengthSlider.value = this.settings.videoLengthThreshold;
    
    this.updateLengthValue();
  }

  updateLengthValue() {
    const valueElement = document.getElementById('lengthValue');
    valueElement.textContent = `${this.settings.videoLengthThreshold} minutes`;
  }



  async saveSettings() {
    try {
      // Filter out empty channel names
      this.settings.targetChannels = this.settings.targetChannels
        .filter(channel => channel.trim().length > 0);
      
      if (this.settings.targetChannels.length === 0) {
        this.showStatus('Please add at least one channel', 'error');
        return;
      }

      await chrome.storage.sync.set(this.settings);
      this.showStatus('Settings saved successfully!', 'success');
      
      // Notify content scripts about settings change
      this.notifyContentScripts();
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showStatus('Error saving settings', 'error');
    }
  }

  async notifyContentScripts() {
    try {
      const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
      
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'settingsUpdated',
          settings: this.settings
        }).catch(() => {
          // Ignore errors for tabs without content script
        });
      }
    } catch (error) {
      console.log('Could not notify content scripts:', error);
    }
  }

  resetSettings() {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      this.settings = {
        targetChannels: [],
        videoLengthThreshold: 10,
        shortsEnabled: true,
        videoAutoPlayEnabled: true,
        autoPlayVideoUrl: 'https://www.youtube.com/watch?v=zZ7AimPACzc'
      };
      
      this.renderUI();
      this.showStatus('Settings reset to default', 'success');
    }
  }

  showStatus(message, type) {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    statusElement.style.display = 'block';
    
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 3000);
  }
}

// Global functions removed - using proper event listeners now

// Initialize options manager
let optionsManager;

document.addEventListener('DOMContentLoaded', () => {
  optionsManager = new OptionsManager();
});

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case 's':
        e.preventDefault();
        saveSettings();
        break;
      case 'r':
        e.preventDefault();
        resetSettings();
        break;
    }
  }
});