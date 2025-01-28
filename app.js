// Initialize VideoJS with global error handler
class IPTVPlayer {
    constructor() {
        this.channels = [];
        this.categories = new Set();
        this.currentPlaylist = null;
        this.videoPlayer = null;
        this.setupEventListeners();
        this.initializePlayer();
    }

    initializePlayer() {
        // Initialize video.js player
        this.videoPlayer = videojs('video-player', {
            html5: {
                hls: {
                    enableLowInitialPlaylist: true,
                    smoothQualityChange: true,
                    overrideNative: true,
                    handleManifestRedirects: true,
                }
            },
            liveui: true,
            responsive: true,
            fluid: true,
            errorDisplay: false,
            loadingSpinner: true,
        });

        // Add error handling
        this.videoPlayer.on('error', () => {
            const error = this.videoPlayer.error();
            console.error('Player error:', error);
            this.showError(`Playback error: ${error.message}`);
        });
    }

    setupEventListeners() {
        document.getElementById('search')?.addEventListener('input', (e) => {
            this.handleSearch(e);
        });
    }

    async loadSamplePlaylist(type) {
        try {
            this.showLoading();
            
            const url = `https://iptv-org.github.io/iptv/index.${type}.m3u`;
            const response = await axios.get(url);
            const content = response.data;
            
            this.currentPlaylist = this.parseM3U(content);
            this.organizeChannels();
            this.updateUI();
            
            this.hideLoading();
        } catch (error) {
            console.error('Failed to load sample playlist:', error);
            this.showError(`Failed to load ${type} playlist: ${error.message}`);
            this.hideLoading();
        }
    }

    async loadCustomPlaylist() {
        const url = document.getElementById('playlist-url')?.value?.trim();
        if (!url) {
            this.showError('Please enter a valid playlist URL');
            return;
        }

        try {
            this.showLoading();
            const response = await axios.get(url);
            const content = response.data;
            
            this.currentPlaylist = this.parseM3U(content);
            this.organizeChannels();
            this.updateUI();
            
            this.hideLoading();
        } catch (error) {
            console.error('Failed to load custom playlist:', error);
            this.showError(`Failed to load custom playlist: ${error.message}`);
            this.hideLoading();
        }
    }

    parseM3U(content) {
        if (!content) return [];

        const channels = [];
        const lines = content.split('\n');
        let currentChannel = null;

        lines.forEach(line => {
            line = line.trim();
            
            if (line.startsWith('#EXTINF:')) {
                const [_, info] = line.split(',');
                let category = 'Uncategorized';
                
                const groupMatch = line.match(/group-title="([^"]*)"/);
                if (groupMatch) {
                    category = groupMatch[1];
                }

                currentChannel = {
                    name: info,
                    category: category
                };
            } else if (line.startsWith('http') && currentChannel) {
                currentChannel.url = line;
                channels.push(currentChannel);
                currentChannel = null;
            }
        });

        return channels;
    }

    organizeChannels() {
        this.categories.clear();
        
        if (this.currentPlaylist) {
            this.currentPlaylist.forEach(channel => {
                if (channel.category) {
                    this.categories.add(channel.category);
                }
            });
        }
    }

    updateUI() {
        this.updateCategories();
        this.updateChannels();
    }

    updateCategories() {
        const categoryList = document.getElementById('category-list');
        if (!categoryList) return;
        
        categoryList.innerHTML = '';

        Array.from(this.categories).sort().forEach(category => {
            const div = document.createElement('div');
            div.className = 'category-item';
            div.textContent = category;
            div.onclick = () => this.filterChannelsByCategory(category);
            categoryList.appendChild(div);
        });
    }

    updateChannels(filter = '') {
        const grid = document.getElementById('channel-grid');
        if (!grid) return;

        grid.innerHTML = '';

        const channels = filter ? 
            this.currentPlaylist.filter(c => c.category === filter) : 
            this.currentPlaylist;

        channels.forEach(channel => {
            const card = this.createChannelCard(channel);
            grid.appendChild(card);
        });
    }

    createChannelCard(channel) {
        const card = document.createElement('div');
        card.className = 'channel-card';
        
        card.innerHTML = `
            <h3>${channel.name}</h3>
            <div class="signal-strength">
                <div class="signal-bar signal-strong"></div>
                <div class="signal-bar signal-medium"></div>
                <div class="signal-bar signal-weak"></div>
            </div>
            <div class="category-tag">${channel.category}</div>
        `;
        
        card.onclick = () => this.playChannel(channel);
        return card;
    }

    async playChannel(channel) {
        try {
            const playerOverlay = document.getElementById('player-overlay');
            const streamInfo = document.getElementById('stream-info');
            
            this.hideError();
            playerOverlay?.classList.remove('hidden');
            if (streamInfo) streamInfo.textContent = `Loading: ${channel.name}`;

            if (!channel.url) {
                throw new Error('Invalid stream URL');
            }

            // Reset player source and load new stream
            this.videoPlayer.src({
                src: channel.url,
                type: 'application/x-mpegURL'
            });

            // Start playback
            await this.videoPlayer.play();
            
            if (streamInfo) {
                streamInfo.textContent = `Now playing: ${channel.name}`;
            }
        } catch (error) {
            console.error('Playback error:', error);
            this.showError('Stream unavailable. Please try another channel.');
            this.videoPlayer.reset();
        }
    }

    handleSearch(event) {
        const searchTerm = event.target.value.toLowerCase();
        
        if (!this.currentPlaylist) return;

        const filtered = this.currentPlaylist.filter(channel => 
            channel.name.toLowerCase().includes(searchTerm)
        );

        const grid = document.getElementById('channel-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        filtered.forEach(channel => {
            const card = this.createChannelCard(channel);
            grid.appendChild(card);
        });
    }

    filterChannelsByCategory(category) {
        this.updateChannels(category);
    }

    showError(message) {
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        }
        console.error(message);
    }

    hideError() {
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.classList.add('hidden');
        }
    }

    showLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.remove('hidden');
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.add('hidden');
    }
}

// Initialize player when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.iptvPlayer = new IPTVPlayer();
});

// Global functions
window.loadSamplePlaylist = function(type) {
    window.iptvPlayer?.loadSamplePlaylist(type);
};

window.loadCustomPlaylist = function() {
    window.iptvPlayer?.loadCustomPlaylist();
};

window.closePlayer = function() {
    try {
        const playerOverlay = document.getElementById('player-overlay');
        if (window.iptvPlayer?.videoPlayer) {
            window.iptvPlayer.videoPlayer.pause();
            window.iptvPlayer.videoPlayer.reset();
        }
        window.iptvPlayer?.hideError();
        if (playerOverlay) {
            playerOverlay.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error closing player:', error);
        window.iptvPlayer?.showError('Error closing player');
    }
};

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    window.iptvPlayer?.showError('An error occurred. Please try again.');
});