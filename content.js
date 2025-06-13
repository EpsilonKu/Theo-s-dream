// Content script for Theo's dream Extension

class YouTubeShortsPopup {
  constructor() {
    this.targetChannels = new Set();
    this.videoLengthThreshold = 10 * 60; // 10 minutes in seconds
    this.popupShown = false;
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.observeVideoChanges();
    this.checkCurrentVideo();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['targetChannels']);
      if (result.targetChannels) {
        this.targetChannels = new Set(result.targetChannels);
      } else {
        // Default channels (can be modified in options)
        this.targetChannels = new Set([
          'Theo - t3․gg',
          'ThePrimeTime'
        ]);
      }
    } catch (error) {
      console.log('Using default channels');
    }
  }

  observeVideoChanges() {
    // YouTube is a SPA, so we need to observe URL changes
    let currentUrl = location.href;
    
    const observer = new MutationObserver(() => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        this.popupShown = false;
        // Longer delay to allow ads to load and potentially finish
        setTimeout(() => this.checkCurrentVideo(), 5000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  async checkCurrentVideo() {
    if (!this.isVideoPage() || this.popupShown) return;

    // Retry mechanism for cases where ads might interfere
    let retries = 3;
    while (retries > 0) {
      const videoData = await this.getVideoData();
      if (videoData) {
        const { channelName, duration } = videoData;
        
        if (this.shouldShowPopup(channelName, duration)) {
          this.showPopup();
        }
        return;
      }
      
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  isVideoPage() {
    return location.pathname === '/watch' && location.search.includes('v=');
  }

  async getVideoData() {
    try {
      // Wait for ads to finish and video metadata to load
      await this.waitForVideoToLoad();
      
      // Try multiple selectors for channel name (more reliable)
      await this.waitForElement('ytd-channel-name #text a, .ytd-video-owner-renderer a');
      await this.waitForElement('.ytp-time-duration');

      // Use more specific channel selector first, fallback to old one
      let channelElement = document.querySelector('ytd-channel-name #text a');
      if (!channelElement) {
        channelElement = document.querySelector('.ytd-video-owner-renderer a');
      }
      
      const durationElement = document.querySelector('.ytp-time-duration');

      if (!channelElement || !durationElement) return null;

      const channelName = channelElement.textContent.trim();
      const durationText = durationElement.textContent.trim();
      const duration = this.parseDuration(durationText);

      return { channelName, duration };
    } catch (error) {
      console.error('Error getting video data:', error);
      return null;
    }
  }

  async waitForVideoToLoad() {
    return new Promise((resolve) => {
      const checkVideo = () => {
        const video = document.querySelector('video');
        const adIndicator = document.querySelector('div.ad-showing, .ytp-ad-text, .ytp-ad-skip-button, .ytp-ad-overlay-container');
        
        // If there's an ad playing, wait for it to finish
        if (adIndicator) {
          setTimeout(checkVideo, 1000);
          return;
        }
        
        // If video is loaded and not an ad, proceed
        if (video && video.duration > 0) {
          resolve();
          return;
        }
        
        // Keep checking
        setTimeout(checkVideo, 500);
      };
      
      checkVideo();
    });
  }

  waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  parseDuration(durationText) {
    const parts = durationText.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1]; // MM:SS
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
    }
    return 0;
  }

  shouldShowPopup(channelName, duration) {
    return this.targetChannels.has(channelName) && duration > this.videoLengthThreshold;
  }

  async showPopup() {
    console.log('Showing YouTube Shorts popup');
    
    // Create and show popup
    this.createPopup();
  }

  createPopup() {
    // Remove existing popup if any
    const existingPopup = document.getElementById('youtube-shorts-popup');
    if (existingPopup) {
      existingPopup.remove();
    }

    // Create popup container
    const popup = document.createElement('div');
    popup.id = 'youtube-shorts-popup';
    popup.className = 'youtube-shorts-popup';

    // Create popup content
    popup.innerHTML = `
      <div class="popup-header">
        <h3>🎬 YouTube Shorts</h3>
        <button class="close-btn" id="popup-close-btn">&times;</button>
      </div>
      <div class="popup-content">
        <iframe 
          src="https://www.youtube.com/shorts/" 
          frameborder="0" 
          allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          class="shorts-iframe">
        </iframe>
      </div>
    `;

    // Add popup to page
    document.body.appendChild(popup);

    // Add close button event listener
    const closeBtn = popup.querySelector('#popup-close-btn');
    closeBtn.addEventListener('click', () => {
      popup.remove();
    });

    // Add drag functionality
    this.makeDraggable(popup);

    // Popup will stay visible until manually closed
  }

  makeDraggable(popup) {
    const header = popup.querySelector('.popup-header');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    header.style.cursor = 'move';

    header.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('close-btn')) return; // Don't drag when clicking close button
      
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;

      if (e.target === header || header.contains(e.target)) {
        isDragging = true;
        popup.style.transition = 'none'; // Disable transition during drag
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        e.preventDefault();
        
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        // Update popup position
        popup.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px))`;
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        popup.style.transition = ''; // Re-enable transitions
      }
    });

    // Prevent text selection during drag
    header.addEventListener('selectstart', (e) => {
      e.preventDefault();
    });
  }
}

// Initialize the extension
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new YouTubeShortsPopup();
  });
} else {
  new YouTubeShortsPopup();
}