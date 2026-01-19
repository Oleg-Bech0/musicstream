// CSS 3D Vortex generator (replaces canvas particle vortex)
function createVortex(numElements = 48, numSub = 12) {
    let vortex = document.getElementById('vortex');
    if (!vortex) {
        vortex = document.createElement('div');
        vortex.className = 'vortex';
        vortex.id = 'vortex';
        document.body.insertBefore(vortex, document.querySelector('.container'));
    }

    vortex.style.setProperty('--_num-elements', numElements);
    vortex.style.setProperty('--_num-sub-elements', numSub);

    // wrapper structure
    const wrapper = document.createElement('div');
    wrapper.className = 'vortex-wrapper';

    const rotY = document.createElement('div'); rotY.className = 'vortex-wrapper-rotation-y';
    const rotX = document.createElement('div'); rotX.className = 'vortex-wrapper-rotation-x';

    // generate elements and sub-elements
    for (let i = 1; i <= numElements; i++) {
        const elem = document.createElement('div');
        elem.className = 'vortex-element';
        elem.style.setProperty('--_i', i);
        // angle per sub-el will be computed in CSS using --_j, we set an inline var for convenience
        for (let j = 1; j <= numSub; j++) {
            const sub = document.createElement('div');
            sub.className = 'vortex-sub-element';
            sub.style.setProperty('--_j', j);
            // compute a CSS variable angle used by the simplified CSS above
            const stepAngle = 12.85; // deg used in original snippet
            const angle = (j - (numSub - 1) * 0.4) * stepAngle;
            sub.style.setProperty('--angle', angle + 'deg');

            const innerA = document.createElement('div');
            const innerB = document.createElement('div');
            innerB.innerHTML = 'VORTEX&nbsp;VORTEX';
            innerA.appendChild(innerB);
            sub.appendChild(innerA);
            elem.appendChild(sub);
        }

        rotX.appendChild(elem);
    }

    rotY.appendChild(rotX);
    wrapper.appendChild(rotY);
    // controls grid (9x9 = 81) used by CSS :has rules for hover interaction
    const controls = document.createElement('div');
    controls.className = 'vortex-controls-wrapper';
    for (let k = 0; k < 81; k++) {
        const cell = document.createElement('div');
        controls.appendChild(cell);
    }

    // clear existing children and append
    vortex.innerHTML = '';
    vortex.appendChild(wrapper);
    vortex.appendChild(controls);
    // ensure background doesn't intercept pointer events except controls area
    controls.style.pointerEvents = 'auto';
}

// Audio & Playlist Variables
let currentTrackIndex = 0;
let isPlaying = false;
let playlist = [];
let allTracks = [];
const audio = document.getElementById('audioPlayer');

// JSONP helper for Deezer (avoids CORS issues by loading JSONP response)
function jsonpFetchDeezer(query, limit = 25, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const cbName = 'dz_cb_' + Math.random().toString(36).slice(2);
        const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}&output=jsonp&callback=${cbName}`;

        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('JSONP timeout'));
        }, timeout);

        function cleanup() {
            clearTimeout(timer);
            try { delete window[cbName]; } catch (e) {}
            const s = document.getElementById(cbName);
            if (s) s.remove();
        }

        window[cbName] = function(data) {
            cleanup();
            resolve(data);
        };

        const script = document.createElement('script');
        script.id = cbName;
        script.src = url;
        script.onerror = function(err) {
            cleanup();
            reject(new Error('JSONP script error'));
        };
        document.body.appendChild(script);
    });
}

// DOM Elements
const trackGrid = document.getElementById('trackGrid');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const progressSlider = document.getElementById('progressSlider');
const progressFill = document.getElementById('progressFill');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const volumeSlider = document.getElementById('volumeSlider');
const searchInput = document.getElementById('searchInput');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const albumArt = document.getElementById('albumArt');
const importBtn = document.getElementById('importBtn');

// Particle class for vortex
class Particle {
    constructor(canvas) {
        this.canvas = canvas;
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 2;
        this.speedY = (Math.random() - 0.5) * 2;
        this.angle = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
    }

    update(centerX, centerY) {
        const dx = centerX - this.x;
        const dy = centerY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 400;

        if (distance < maxDistance) {
            const force = (maxDistance - distance) / maxDistance;
            this.speedX += (dx / distance) * force * 0.1;
            this.speedY += (dy / distance) * force * 0.1;
        }

        this.x += this.speedX;
        this.y += this.speedY;
        this.angle += this.rotationSpeed;

        // Friction
        this.speedX *= 0.99;
        this.speedY *= 0.99;

        // Bounce off edges
        if (this.x < 0) { this.x = this.canvas.width; this.speedX *= -1; }
        if (this.x > this.canvas.width) { this.x = 0; this.speedX *= -1; }
        if (this.y < 0) { this.y = this.canvas.height; this.speedY *= -1; }
        if (this.y > this.canvas.height) { this.y = 0; this.speedY *= -1; }
    }

    draw(ctx) {
        ctx.fillStyle = `rgba(102, 126, 234, 0.5)`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initVortex() {
    vortexCanvas = document.getElementById('vortexCanvas');
    vortexCtx = vortexCanvas.getContext('2d');
    vortexCanvas.width = window.innerWidth;
    vortexCanvas.height = window.innerHeight;

    particles = [];
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle(vortexCanvas));
    }

    animateVortex();
}

function animateVortex() {
    const centerX = vortexCanvas.width / 2;
    const centerY = vortexCanvas.height / 2;

    vortexCtx.clearRect(0, 0, vortexCanvas.width, vortexCanvas.height);

    particles.forEach(particle => {
        particle.update(centerX, centerY);
        particle.draw(vortexCtx);
    });

    requestAnimationFrame(animateVortex);
}

window.addEventListener('resize', () => {
    if (vortexCanvas) {
        vortexCanvas.width = window.innerWidth;
        vortexCanvas.height = window.innerHeight;
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // create CSS-based vortex matching the requested markup
    createVortex(48, 12);
    loadTracks();
    setupEventListeners();
    setupAudioListeners();
    setupNavigation();
    volumeSlider.value = 70;
    audio.volume = 0.7;
});

async function loadTracks() {
    trackGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #fff;">Loading 500+ tracks...</div>';
    
    try {
        // Curated trending artists list for better quality tracks
        const queries = [
            'Taylor Swift', 'Drake', 'Bad Bunny', 'The Weeknd', 'Dua Lipa',
            'Olivia Rodrigo', 'Billie Eilish', 'Doja Cat', 'Kendrick Lamar', 'Kanye West',
            'Khalid', 'SZA', 'Dua Lipa', 'Ariana Grande', 'Post Malone',
            'Harry Styles', 'Adele', 'Travis Scott', 'Drake', 'J Balvin', 'The Kid LAROI',
            'Jack Harlow', 'Beyonce', 'Imagine Dragons', 'Rihanna', 'Shawn Mendes',
            'Bruno Mars', 'Calvin Harris', 'David Guetta', 'The Chainsmokers', 'Avicii'
        ];
        
        allTracks = [];
        
        for (let query of queries) {
                try {
                    // use JSONP to avoid CORS blocking
                    const data = await jsonpFetchDeezer(query, 25).catch(err => { console.log('jsonp error', err); return null; });
                    if (data && data.data) {
                        data.data.forEach(track => {
                            if (track.preview && track.preview.length > 0) {
                                allTracks.push({
                                    id: track.id,
                                    title: track.title,
                                    artist: track.artist.name,
                                    duration: track.duration,
                                    preview: track.preview,
                                    image: track.album && track.album.cover_medium ? track.album.cover_medium : '',
                                    album: track.album && track.album.title ? track.album.title : ''
                                });
                            }
                        });
                    }
                } catch (e) {
                    console.log(`Error loading ${query}:`, e);
                }
        }
    } catch (error) {
        console.log('API Error:', error);
    }

    if (allTracks.length === 0) {
        generateFallbackTracks();
    }

    // Remove duplicates by ID
    const uniqueTracks = Array.from(new Map(allTracks.map(t => [t.id, t])).values());
    allTracks = uniqueTracks;
    
    playlist = [...allTracks];
    renderTracks(playlist);
}

function generateFallbackTracks() {
    allTracks = [
        { id: 1, title: 'Summer Hit', artist: 'Cool Musicians', duration: 240, preview: '', image: '', album: 'Summer Album' },
        { id: 2, title: 'Night Drive', artist: 'Night Cruisers', duration: 200, preview: '', image: '', album: 'Highway' },
        { id: 3, title: 'Energy Boost', artist: 'DJ Mix', duration: 210, preview: '', image: '', album: 'Energy' }
    ];
}

function renderTracks(tracks) {
    trackGrid.innerHTML = '';
    
    if (tracks.length === 0) {
        trackGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: rgba(255,255,255,0.6);">No tracks found</div>';
        return;
    }

    tracks.forEach((track, index) => {
        const card = document.createElement('div');
        card.className = 'track-card';
        
        const hasPreview = track.preview ? '▶️' : '🎵';
        const imageStyle = track.image ? `background-image: url('${track.image}'); background-size: cover;` : '';
        
        card.innerHTML = `
            <div class="track-card-image" style="${imageStyle}">${hasPreview}</div>
            <div class="track-card-title" title="${track.title}">${track.title}</div>
            <div class="track-card-artist" title="${track.artist}">${track.artist}</div>
            <div class="track-card-duration">${formatTime(track.duration)}</div>
        `;
        
        card.addEventListener('click', () => {
            currentTrackIndex = playlist.indexOf(track);
            if (track.preview && track.preview.length > 0) {
                playTrack();
            } else if (track.externalUrl) {
                window.open(track.externalUrl, '_blank');
            } else {
                alert('Preview not available for this track');
            }
        });
        
        trackGrid.appendChild(card);
    });
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

function playTrack() {
    if (playlist.length === 0) return;
    
    const track = playlist[currentTrackIndex];
    
    if (!track.preview) {
        alert('Preview not available for this track');
        return;
    }

    audio.src = track.preview;
    audio.play();
    isPlaying = true;
    updateUI();
}

function updateUI() {
    if (playlist.length === 0) return;
    
    const track = playlist[currentTrackIndex];
    trackTitle.textContent = track.title;
    trackArtist.textContent = track.artist;
    durationEl.textContent = formatTime(track.duration);
    albumArt.textContent = '🎵';
    
    playBtn.textContent = isPlaying ? '⏸️' : '▶️';
}

function togglePlayPause() {
    if (playlist.length === 0) return;
    
    if (audio.src === '') {
        playTrack();
    } else if (isPlaying) {
        audio.pause();
        isPlaying = false;
    } else {
        audio.play();
        isPlaying = true;
    }
    updateUI();
}

function playNextTrack() {
    if (playlist.length === 0) return;
    currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
    playTrack();
}

function playPreviousTrack() {
    if (playlist.length === 0) return;
    currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    playTrack();
}

function setupEventListeners() {
    playBtn.addEventListener('click', togglePlayPause);
    nextBtn.addEventListener('click', playNextTrack);
    prevBtn.addEventListener('click', playPreviousTrack);
    
    volumeSlider.addEventListener('input', (e) => {
        audio.volume = e.target.value / 100;
    });

    progressSlider.addEventListener('input', (e) => {
        const time = (e.target.value / 100) * audio.duration;
        audio.currentTime = time;
    });

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        playlist = allTracks.filter(track => 
            track.title.toLowerCase().includes(query) || 
            track.artist.toLowerCase().includes(query)
        );
        currentTrackIndex = 0;
        renderTracks(playlist);
    });

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            togglePlayPause();
        }
        if (e.code === 'ArrowRight') playNextTrack();
        if (e.code === 'ArrowLeft') playPreviousTrack();
    });
    if (importBtn) {
        importBtn.addEventListener('click', showImportModal);
    }
}

// --- SoundCloud Likes Import flow ---
function showImportModal() {
    // create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'sc-import-overlay';
    overlay.style.position = 'fixed';
    overlay.style.left = 0;
    overlay.style.top = 0;
    overlay.style.right = 0;
    overlay.style.bottom = 0;
    overlay.style.background = 'rgba(0,0,0,0.7)';
    overlay.style.zIndex = 9999;
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const modal = document.createElement('div');
    modal.style.width = '720px';
    modal.style.maxWidth = '95%';
    modal.style.background = '#0f1720';
    modal.style.border = '1px solid rgba(255,255,255,0.06)';
    modal.style.padding = '16px';
    modal.style.borderRadius = '8px';
    modal.style.color = '#fff';
    modal.style.boxShadow = '0 10px 40px rgba(0,0,0,0.6)';

    modal.innerHTML = `
        <h3 style="margin:0 0 8px 0">Import SoundCloud Likes</h3>
        <p style="margin:0 0 12px 0; color:rgba(255,255,255,0.7)">Paste SoundCloud track URLs (one per line). Example: https://soundcloud.com/artist/track-name</p>
    `;

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Paste SoundCloud track URLs here...';
    textarea.style.width = '100%';
    textarea.style.height = '180px';
    textarea.style.background = '#071025';
    textarea.style.color = '#fff';
    textarea.style.border = '1px solid rgba(255,255,255,0.04)';
    textarea.style.padding = '8px';
    textarea.style.borderRadius = '4px';
    textarea.style.marginBottom = '10px';

    const hint = document.createElement('div');
    hint.style.fontSize = '12px';
    hint.style.color = 'rgba(255,255,255,0.6)';
    hint.style.marginBottom = '10px';
    hint.textContent = 'If you prefer, you can also copy the list of liked track URLs from your SoundCloud likes page and paste them here.';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';
    actions.style.gap = '8px';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.padding = '8px 12px';
    cancelBtn.style.background = 'transparent';
    cancelBtn.style.color = '#fff';
    cancelBtn.style.border = '1px solid rgba(255,255,255,0.06)';
    cancelBtn.style.borderRadius = '4px';

    const importBtnModal = document.createElement('button');
    importBtnModal.textContent = 'Import';
    importBtnModal.style.padding = '8px 12px';
    importBtnModal.style.background = '#2563eb';
    importBtnModal.style.color = '#fff';
    importBtnModal.style.border = 'none';
    importBtnModal.style.borderRadius = '4px';

    actions.appendChild(cancelBtn);
    actions.appendChild(importBtnModal);

    modal.appendChild(textarea);
    modal.appendChild(hint);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    cancelBtn.addEventListener('click', () => closeImportModal(overlay));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeImportModal(overlay); });

    importBtnModal.addEventListener('click', async () => {
        const raw = textarea.value.trim();
        if (!raw) {
            alert('Please paste one or more SoundCloud track URLs (one per line).');
            return;
        }
        importBtnModal.disabled = true;
        importBtnModal.textContent = 'Importing...';
        try {
            const urls = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
            await importSoundCloudUrls(urls);
            alert('Import finished. Tracks added to the library where possible.');
            closeImportModal(overlay);
        } catch (err) {
            console.error('Import error', err);
            alert('Import failed — check console for details.');
            importBtnModal.disabled = false;
            importBtnModal.textContent = 'Import';
        }
    });
}

function closeImportModal(overlay) {
    try { overlay.remove(); } catch (e) { overlay.style.display = 'none'; }
}

async function fetchSoundCloudOEmbed(trackUrl) {
    const oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(trackUrl)}`;
    try {
        const res = await fetch(oembedUrl);
        if (!res.ok) throw new Error('oEmbed fetch failed');
        const data = await res.json();
        // data contains: title, author_name, thumbnail_url
        return {
            title: data.title || '',
            author: data.author_name || '',
            thumbnail: data.thumbnail_url || ''
        };
    } catch (e) {
        console.warn('oEmbed failed for', trackUrl, e);
        return null;
    }
}

async function importSoundCloudUrls(urls = []) {
    let added = 0;
    for (const url of urls) {
        try {
            const o = await fetchSoundCloudOEmbed(url);
            if (!o) {
                // Could not get metadata — add a placeholder entry linking to URL
                allTracks.unshift({ id: 'sc-' + url, title: url.split('/').pop() || url, artist: '', duration: 0, preview: '', image: '', externalUrl: url });
                continue;
            }

            // Try to resolve a playable preview via Deezer using title + author
            const query = `${o.title} ${o.author}`.trim();
            let found = null;
            try {
                const deezerRes = await jsonpFetchDeezer(query, 6).catch(err => { console.warn('Deezer jsonp failed', err); return null; });
                if (deezerRes && deezerRes.data && deezerRes.data.length > 0) {
                    // pick first track that has preview
                    found = deezerRes.data.find(t => t.preview && t.preview.length > 0) || deezerRes.data[0];
                }
            } catch (e) {
                console.warn('Deezer search error', e);
            }

            if (found && found.preview) {
                const trackObj = {
                    id: found.id,
                    title: found.title || o.title,
                    artist: found.artist && found.artist.name ? found.artist.name : o.author,
                    duration: found.duration || 0,
                    preview: found.preview,
                    image: (found.album && found.album.cover_medium) || o.thumbnail || '',
                    album: (found.album && found.album.title) || ''
                };
                // add to the front so user sees recently imported items
                allTracks.unshift(trackObj);
                added++;
            } else {
                // add as non-playable fallback with thumbnail
                allTracks.unshift({ id: 'sc-' + url, title: o.title || url, artist: o.author || '', duration: 0, preview: '', image: o.thumbnail || '', externalUrl: url });
            }
            // be polite and wait a short moment to avoid hitting rate limits
            await new Promise(r => setTimeout(r, 250));
        } catch (e) {
            console.error('Failed to import', url, e);
        }
    }

    // dedupe and render updated list
    const unique = Array.from(new Map(allTracks.map(t => [t.id, t])).values());
    allTracks = unique;
    playlist = [...allTracks];
    currentTrackIndex = 0;
    renderTracks(playlist);
    console.log(`Imported ${added} playable tracks from provided SoundCloud URLs.`);
}

function setupAudioListeners() {
    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            const progress = (audio.currentTime / audio.duration) * 100;
            progressFill.style.width = progress + '%';
            currentTimeEl.textContent = formatTime(audio.currentTime);
        }
    });

    audio.addEventListener('ended', () => {
        playNextTrack();
    });

    audio.addEventListener('loadedmetadata', () => {
        durationEl.textContent = formatTime(audio.duration);
    });
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            filterByCategory(index);
        });
    });
}

function filterByCategory(categoryIndex) {
    let filtered = [];
    
    switch(categoryIndex) {
        case 0:
            filtered = [...allTracks];
            break;
        case 1:
            filtered = allTracks.slice(0, Math.min(20, allTracks.length));
            break;
        case 2:
            filtered = allTracks;
            break;
        case 3:
            filtered = allTracks.slice(0, 15);
            break;
        case 4:
            filtered = allTracks.slice(0, 10);
            break;
        default:
            filtered = [...allTracks];
    }
    
    playlist = filtered;
    currentTrackIndex = 0;
    renderTracks(playlist);
}

console.log('MusicStream loaded successfully!');
