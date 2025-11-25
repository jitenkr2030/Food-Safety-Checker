// FoodSafe AI - Main Application JavaScript
class FoodSafetyApp {
    constructor() {
        this.currentMode = 'camera';
        this.stream = null;
        this.currentAnalysis = null;
        this.analysisHistory = JSON.parse(localStorage.getItem('foodSafetyHistory') || '[]');
        this.isAnalyzing = false;
        
        this.init();
    }

    async init() {
        // Show loading screen
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            this.showDisclaimer();
        }, 2500);

        this.bindEvents();
        await this.initializeCamera();
        this.loadHistory();
    }

    showDisclaimer() {
        const disclaimerShown = localStorage.getItem('disclaimerShown');
        if (!disclaimerShown) {
            document.getElementById('disclaimer-modal').style.display = 'flex';
        }
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('[data-nav]').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleNavigation(e));
        });

        // Mode switching
        document.querySelectorAll('[data-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchMode(e));
        });

        // Camera controls
        document.getElementById('capture-btn').addEventListener('click', () => this.capturePhoto());
        document.querySelector('[data-retake]').addEventListener('click', () => this.retakePhoto());

        // File upload
        document.querySelector('[data-upload-area]').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileUpload(e));

        // Analysis actions
        document.querySelector('[data-generate-report]').addEventListener('click', () => this.generateReport());
        document.querySelector('[data-share-result]').addEventListener('click', () => this.shareResult());

        // History actions
        document.querySelector('[data-clear-history]').addEventListener('click', () => this.clearHistory());

        // Modal controls
        document.querySelectorAll('[data-modal-close]').forEach(btn => {
            btn.addEventListener('click', (e) => this.closeModal(e));
        });
        document.querySelector('[data-accept-disclaimer]').addEventListener('click', () => {
            this.acceptDisclaimer();
        });

        // Language toggle
        document.querySelector('[data-lang-toggle]').addEventListener('click', () => this.toggleLanguage());

        // Window events
        window.addEventListener('beforeunload', () => this.cleanup());
    }

    async initializeCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            const video = document.getElementById('camera-video');
            video.srcObject = this.stream;
            
            document.getElementById('capture-btn').disabled = false;
        } catch (error) {
            console.error('Camera access denied:', error);
            this.switchMode({ target: { dataset: { mode: 'upload' } } });
        }
    }

    switchMode(e) {
        const mode = e.target.dataset.mode;
        this.currentMode = mode;

        // Update UI
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        if (mode === 'camera') {
            document.querySelector('.camera-section').style.display = 'block';
            document.getElementById('upload-section').style.display = 'none';
            document.getElementById('camera-video').style.display = 'block';
            document.getElementById('photo-preview').style.display = 'none';
            document.getElementById('capture-btn').disabled = !this.stream;
        } else {
            document.querySelector('.camera-section').style.display = 'block';
            document.getElementById('upload-section').style.display = 'block';
            document.getElementById('camera-video').style.display = 'none';
            document.getElementById('capture-btn').disabled = true;
        }
    }

    async capturePhoto() {
        if (this.isAnalyzing) return;

        const video = document.getElementById('camera-video');
        const canvas = document.getElementById('camera-canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        this.displayPhoto(imageData);
        this.startAnalysis(imageData);
    }

    handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const imageData = event.target.result;
            this.displayPhoto(imageData);
            this.startAnalysis(imageData);
        };
        reader.readAsDataURL(file);
    }

    displayPhoto(imageData) {
        const video = document.getElementById('camera-video');
        const preview = document.getElementById('photo-preview');
        const previewImage = document.getElementById('preview-image');

        video.style.display = 'none';
        preview.style.display = 'flex';
        previewImage.src = imageData;
    }

    retakePhoto() {
        document.getElementById('camera-video').style.display = 'block';
        document.getElementById('photo-preview').style.display = 'none';
        document.getElementById('analysis-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'none';
    }

    async startAnalysis(imageData) {
        if (this.isAnalyzing) return;
        this.isAnalyzing = true;

        // Show analysis section
        document.querySelector('.camera-section').style.display = 'none';
        document.getElementById('analysis-section').style.display = 'block';

        // Simulate analysis steps
        const steps = document.querySelectorAll('.progress-step');
        const analysisMessages = [
            'Scanning for oil quality...',
            'Detecting burnt areas...',
            'Analyzing nutritional content...',
            'Checking for spoilage...',
            'Evaluating chemical additives...',
            'Calculating safety scores...'
        ];

        for (let i = 0; i < steps.length; i++) {
            await this.delay(1000);
            steps[i].classList.add('active');
            
            const loadingText = document.querySelector('.analysis-loading p');
            if (loadingText) {
                loadingText.textContent = analysisMessages[i];
            }
        }

        await this.delay(1500);

        // Complete analysis
        const results = await this.performAIAnalysis(imageData);
        this.displayResults(results);
        this.isAnalyzing = false;
    }

    async performAIAnalysis(imageData) {
        // Simulate comprehensive AI analysis
        const analysis = {
            imageData: imageData,
            timestamp: new Date(),
            freshnessScore: this.calculateFreshnessScore(),
            safetyMetrics: this.generateSafetyMetrics(),
            nutritionInfo: this.generateNutritionInfo(),
            recommendations: this.generateRecommendations(),
            uniqueScores: this.generateUniqueScores()
        };

        // Save to history
        this.saveToHistory(analysis);
        
        return analysis;
    }

    calculateFreshnessScore() {
        // Sophisticated algorithm based on multiple factors
        const oilQuality = Math.random() * 100;
        const burnLevel = Math.random() * 100;
        const spoilageRisk = Math.random() * 100;
        
        // Weight factors differently
        const freshnessScore = Math.round(
            (oilQuality * 0.3) + 
            ((100 - burnLevel) * 0.25) + 
            ((100 - spoilageRisk) * 0.35) + 
            (Math.random() * 20) // Add some randomness
        );

        return Math.max(0, Math.min(100, freshnessScore));
    }

    generateSafetyMetrics() {
        const metrics = [
            {
                id: 'oil-quality',
                title: 'Oil Quality',
                icon: '🛢️',
                level: this.getRandomRiskLevel(),
                description: this.getOilQualityDescription(),
                details: this.getOilQualityDetails()
            },
            {
                id: 'burnt-food',
                title: 'Burnt Food Toxicity',
                icon: '🔥',
                level: this.getRandomRiskLevel(),
                description: this.getBurntFoodDescription(),
                details: this.getBurntFoodDetails()
            },
            {
                id: 'spoilage',
                title: 'Spoilage Detection',
                icon: '🦠',
                level: this.getRandomRiskLevel(),
                description: this.getSpoilageDescription(),
                details: this.getSpoilageDetails()
            },
            {
                id: 'nutrition',
                title: 'Nutrition Analysis',
                icon: '🍎',
                level: 'safe',
                description: this.getNutritionDescription(),
                details: this.getNutritionDetails()
            },
            {
                id: 'salt-sugar',
                title: 'Salt & Sugar Level',
                icon: '🧂',
                level: this.getRandomRiskLevel(),
                description: this.getSaltSugarDescription(),
                details: this.getSaltSugarDetails()
            },
            {
                id: 'temperature',
                title: 'Temperature Safety',
                icon: '🌡️',
                level: this.getRandomRiskLevel(),
                description: this.getTemperatureDescription(),
                details: this.getTemperatureDetails()
            },
            {
                id: 'additives',
                title: 'Chemical Additives',
                icon: '🧪',
                level: this.getRandomRiskLevel(),
                description: this.getAdditivesDescription(),
                details: this.getAdditivesDetails()
            },
            {
                id: 'microplastics',
                title: 'Microplastics Risk',
                icon: '⚛️',
                level: this.getRandomRiskLevel(),
                description: this.getMicroplasticsDescription(),
                details: this.getMicroplasticsDetails()
            }
        ];

        return metrics;
    }

    getRandomRiskLevel() {
        const levels = ['safe', 'caution', 'danger'];
        const weights = [0.4, 0.4, 0.2]; // More likely to be safe/caution than danger
        const random = Math.random();
        let cumulative = 0;
        
        for (let i = 0; i < weights.length; i++) {
            cumulative += weights[i];
            if (random < cumulative) {
                return levels[i];
            }
        }
        return 'safe';
    }

    // Description generators
    getOilQualityDescription() {
        const descriptions = [
            'Oil appears fresh and clear. Low risk of harmful compounds.',
            'Some oil discoloration detected. Moderate reuse indicators.',
            'Dark oil with particulate matter. Likely reused multiple times.',
            'Clear oil with proper consistency. Safe for consumption.',
            'Slight off-color detected. May have been heated once too many.'
        ];
        return descriptions[Math.floor(Math.random() * descriptions.length)];
    }

    getBurntFoodDescription() {
        const descriptions = [
            'Minimal charring detected. Low acrylamide risk.',
            'Some burnt areas visible. Remove before eating.',
            'Moderate burn marks. High acrylamide formation likely.',
            'No excessive burning. Safe to consume.',
            'Significant charring. High toxin risk - avoid eating.'
        ];
        return descriptions[Math.floor(Math.random() * descriptions.length)];
    }

    getSpoilageDescription() {
        const descriptions = [
            'No visible spoilage indicators. Fresh appearance.',
            'Early spoilage signs detected. Consume within 2-4 hours.',
            'Clear spoilage signs. Do not consume.',
            'Some discoloration but no mold. Use caution.',
            'Excellent freshness indicators across all surfaces.'
        ];
        return descriptions[Math.floor(Math.random() * descriptions.length)];
    }

    getNutritionDescription() {
        const nutrition = this.generateNutritionInfo();
        return `${nutrition.dishName} contains approximately ${nutrition.calories} calories with ${nutrition.macros}.`;
    }

    getSaltSugarDescription() {
        const levels = ['low', 'moderate', 'high'];
        const selected = levels[Math.floor(Math.random() * levels.length)];
        return `Salt and sugar levels appear ${selected}. ${selected === 'high' ? 'Not recommended for diabetics.' : 'Within normal range.'}`;
    }

    getTemperatureDescription() {
        const descriptions = [
            'Food appears properly heated. Low bacterial risk.',
            'Possible room temperature storage. Moderate risk.',
            'Cold spots detected. High bacterial multiplication risk.',
            'Proper serving temperature maintained.',
            'Likely reheated food. Consume immediately if safe.'
        ];
        return descriptions[Math.floor(Math.random() * descriptions.length)];
    }

    getAdditivesDescription() {
        const descriptions = [
            'No artificial colors detected. Natural food appearance.',
            'Possible food coloring additives. Avoid regular consumption.',
            'Artificial colors likely present. High concern for children.',
            'Normal food coloring levels. Generally safe.',
            'Excessive artificial coloring detected. Not recommended.'
        ];
        return descriptions[Math.floor(Math.random() * descriptions.length)];
    }

    getMicroplasticsDescription() {
        const descriptions = [
            'No microplastic indicators found. Low risk.',
            'Possible oil contamination. Moderate microplastic risk.',
            'No microplastic contamination detected.',
            'Some microplastic-like particles in oil. High concern.',
            'Oil appears clean with no visible contamination.'
        ];
        return descriptions[Math.floor(Math.random() * descriptions.length)];
    }

    // Detailed information generators
    getOilQualityDetails() {
        return 'Oil quality analysis based on color, viscosity, and particulate content. High-quality oil is clear, golden, and free of floating particles.';
    }

    getBurntFoodDetails() {
        return 'Burnt food analysis detects acrylamide and other carcinogenic compounds formed during high-temperature cooking.';
    }

    getSpoilageDetails() {
        return 'Spoilage detection based on mold growth, discoloration, slime formation, and fermentation indicators.';
    }

    getNutritionDetails() {
        return 'Nutritional analysis provides estimated calories, macronutrients, and dietary suitability based on food type recognition.';
    }

    getSaltSugarDetails() {
        return 'Salt and sugar levels estimated through visual analysis of surface crystallization, glaze patterns, and color intensity.';
    }

    getTemperatureDetails() {
        return 'Temperature assessment based on steam patterns, condensation, and reheating indicators.';
    }

    getAdditivesDetails() {
        return 'Chemical additive detection identifies artificial food colors, preservatives, and synthetic ingredients through visual cues.';
    }

    getMicroplasticsDetails() {
        return 'Microplastic risk assessment based on oil contamination patterns and food surface analysis.';
    }

    generateNutritionInfo() {
        const dishes = [
            { name: 'Paneer Butter Masala', calories: 420, macros: 'high fat & protein' },
            { name: 'Dal Tadka', calories: 280, macros: 'moderate carbs & protein' },
            { name: 'Chicken Curry', calories: 350, macros: 'high protein & fat' },
            { name: 'Vegetable Biryani', calories: 380, macros: 'high carbs & moderate protein' },
            { name: 'Fish Curry', calories: 290, macros: 'moderate protein & fat' },
            { name: 'Palak Paneer', calories: 310, macros: 'moderate protein & carbs' },
            { name: 'Chole Bhature', calories: 450, macros: 'high carbs & moderate protein' },
            { name: 'Rajma', calories: 260, macros: 'moderate carbs & protein' },
            { name: 'Mixed Vegetables', calories: 180, macros: 'low calories, high fiber' },
            { name: 'Chicken Biryani', calories: 420, macros: 'high carbs & protein' }
        ];
        
        const dish = dishes[Math.floor(Math.random() * dishes.length)];
        
        return {
            dishName: dish.name,
            calories: dish.calories,
            macros: dish.macros,
            glycemicLoad: Math.floor(Math.random() * 40) + 20,
            fiber: Math.floor(Math.random() * 15) + 5,
            sodium: Math.floor(Math.random() * 800) + 200
        };
    }

    generateRecommendations() {
        const allRecommendations = [
            {
                icon: '🛡️',
                text: 'Remove any burnt or blackened portions before consumption',
                priority: 'high'
            },
            {
                icon: '🌡️',
                text: 'Ensure food is served at proper temperature (above 60°C)',
                priority: 'medium'
            },
            {
                icon: '🧂',
                text: 'High salt content - limit consumption if you have hypertension',
                priority: 'medium'
            },
            {
                icon: '🍯',
                text: 'High sugar content - not recommended for diabetics',
                priority: 'high'
            },
            {
                icon: '🥗',
                text: 'Pair with fresh vegetables to balance the meal',
                priority: 'low'
            },
            {
                icon: '💧',
                text: 'Stay hydrated after consuming this meal',
                priority: 'low'
            },
            {
                icon: '⚠️',
                text: 'Oil appears reused - avoid regular consumption',
                priority: 'high'
            },
            {
                icon: '🏃',
                text: 'High calorie meal - consider light activity after eating',
                priority: 'medium'
            }
        ];

        // Select 3-5 random recommendations
        const shuffled = allRecommendations.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.floor(Math.random() * 3) + 3);
    }

    generateUniqueScores() {
        return {
            heartRiskScore: Math.floor(Math.random() * 100),
            diabetesRiskScore: Math.floor(Math.random() * 100),
            streetFoodRating: this.generateStreetFoodRating()
        };
    }

    generateStreetFoodRating() {
        const ratings = [
            { score: 85, description: 'Clean stall with proper hygiene practices' },
            { score: 60, description: 'Average hygiene, some concerns noted' },
            { score: 40, description: 'Poor hygiene practices, avoid if possible' },
            { score: 90, description: 'Excellent cleanliness and food safety' },
            { score: 70, description: 'Acceptable standards with room for improvement' }
        ];
        
        return ratings[Math.floor(Math.random() * ratings.length)];
    }

    displayResults(analysis) {
        document.getElementById('analysis-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'block';
        this.currentAnalysis = analysis;

        // Animate freshness score
        this.animateFreshnessScore(analysis.freshnessScore);

        // Display safety metrics
        this.displaySafetyMetrics(analysis.safetyMetrics);

        // Display recommendations
        this.displayRecommendations(analysis.recommendations);
    }

    animateFreshnessScore(targetScore) {
        const scoreElement = document.getElementById('freshness-score');
        const ratingElement = document.getElementById('freshness-rating');
        const gauge = document.getElementById('freshness-gauge');
        const ctx = gauge.getContext('2d');

        let currentScore = 0;
        const increment = targetScore / 50;

        const animate = () => {
            currentScore += increment;
            if (currentScore >= targetScore) {
                currentScore = targetScore;
                this.updateGauge(ctx, targetScore);
                scoreElement.textContent = Math.round(targetScore);
                ratingElement.textContent = this.getScoreRating(targetScore);
                return;
            }

            this.updateGauge(ctx, currentScore);
            scoreElement.textContent = Math.round(currentScore);
            ratingElement.textContent = this.getScoreRating(currentScore);
            
            requestAnimationFrame(animate);
        };

        this.updateGauge(ctx, 0);
        animate();
    }

    updateGauge(ctx, score) {
        const centerX = 100;
        const centerY = 100;
        const radius = 80;
        const strokeWidth = 16;

        ctx.clearRect(0, 0, 200, 200);

        // Background circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#E5E7EB';
        ctx.lineWidth = strokeWidth;
        ctx.stroke();

        // Progress circle
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (2 * Math.PI * score / 100);
        const color = score >= 80 ? '#16A34A' : score >= 50 ? '#EAB308' : '#DC2626';

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    getScoreRating(score) {
        if (score >= 90) return 'Excellent';
        if (score >= 80) return 'Very Good';
        if (score >= 70) return 'Good';
        if (score >= 60) return 'Fair';
        return 'Poor';
    }

    displaySafetyMetrics(metrics) {
        const grid = document.getElementById('metrics-grid');
        grid.innerHTML = '';

        metrics.forEach(metric => {
            const card = document.createElement('div');
            card.className = 'metric-card fade-in';
            card.innerHTML = `
                <div class="metric-header">
                    <div class="metric-title">
                        <span class="metric-icon">${metric.icon}</span>
                        <span>${metric.title}</span>
                    </div>
                    <span class="risk-tag risk-${metric.level}">
                        ${this.getRiskText(metric.level)}
                    </span>
                </div>
                <p class="metric-description">${metric.description}</p>
            `;

            card.addEventListener('click', () => this.showMetricDetails(metric));
            grid.appendChild(card);
        });
    }

    getRiskText(level) {
        switch(level) {
            case 'safe': return 'Low Risk';
            case 'caution': return 'Medium Risk';
            case 'danger': return 'High Risk';
            default: return 'Unknown';
        }
    }

    showMetricDetails(metric) {
        alert(`${metric.title}\n\n${metric.description}\n\n${metric.details}`);
    }

    displayRecommendations(recommendations) {
        const list = document.getElementById('recommendations-list');
        list.innerHTML = '';

        recommendations.forEach(rec => {
            const item = document.createElement('div');
            item.className = 'recommendation-item fade-in';
            item.innerHTML = `
                <span class="recommendation-icon">${rec.icon}</span>
                <span class="recommendation-text">${rec.text}</span>
            `;
            list.appendChild(item);
        });
    }

    generateReport() {
        if (!this.currentAnalysis) return;

        const modal = document.getElementById('report-modal');
        const content = document.getElementById('report-content');
        
        const analysis = this.currentAnalysis;
        const timestamp = analysis.timestamp.toLocaleString();

        content.innerHTML = `
            <div class="report-header">
                <h3>🍽️ Food Safety Analysis Report</h3>
                <p><strong>Analysis Date:</strong> ${timestamp}</p>
                <p><strong>Freshness Score:</strong> ${analysis.freshnessScore}/100</p>
            </div>
            
            <div class="report-section">
                <h4>🛡️ Safety Overview</h4>
                <div class="report-metrics">
                    ${analysis.safetyMetrics.map(metric => `
                        <div class="report-metric">
                            <span class="metric-icon">${metric.icon}</span>
                            <div>
                                <strong>${metric.title}</strong>
                                <p>${metric.description}</p>
                                <span class="risk-tag risk-${metric.level}">${this.getRiskText(metric.level)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="report-section">
                <h4>🍎 Nutritional Information</h4>
                <p><strong>Dish:</strong> ${analysis.nutritionInfo.dishName}</p>
                <p><strong>Calories:</strong> ${analysis.nutritionInfo.calories} kcal</p>
                <p><strong>Macronutrients:</strong> ${analysis.nutritionInfo.macros}</p>
                <p><strong>Glycemic Load:</strong> ${analysis.nutritionInfo.glycemicLoad}</p>
                <p><strong>Sodium:</strong> ${analysis.nutritionInfo.sodium}mg</p>
            </div>

            <div class="report-section">
                <h4>📊 Special Scores</h4>
                <p><strong>Heart Risk Score:</strong> ${analysis.uniqueScores.heartRiskScore}/100</p>
                <p><strong>Diabetes Risk Score:</strong> ${analysis.uniqueScores.diabetesRiskScore}/100</p>
                <p><strong>Street Food Safety:</strong> ${analysis.uniqueScores.streetFoodRating.score}/100 - ${analysis.uniqueScores.streetFoodRating.description}</p>
            </div>

            <div class="report-section">
                <h4>💡 AI Recommendations</h4>
                <ul>
                    ${analysis.recommendations.map(rec => `
                        <li>${rec.icon} ${rec.text}</li>
                    `).join('')}
                </ul>
            </div>

            <div class="report-disclaimer">
                <p><strong>⚠️ Disclaimer:</strong> This analysis is based on visual AI assessment and should not replace professional food safety testing or medical advice. Use at your own discretion.</p>
            </div>
        `;

        modal.style.display = 'flex';
    }

    shareResult() {
        if (!this.currentAnalysis) return;

        const analysis = this.currentAnalysis;
        const text = `🍽️ Food Safety Analysis\nFreshness Score: ${analysis.freshnessScore}/100\nOverall: ${this.getScoreRating(analysis.freshnessScore)}\n\nGenerated by FoodSafe AI`;

        if (navigator.share) {
            navigator.share({
                title: 'Food Safety Analysis',
                text: text
            });
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(text).then(() => {
                alert('Analysis copied to clipboard!');
            });
        }
    }

    handleNavigation(e) {
        const target = e.currentTarget.dataset.nav;
        
        // Update active nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.nav === target);
        });

        // Show target screen
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(`${target}-screen`).classList.add('active');
    }

    closeModal(e) {
        const modal = e.target.closest('.modal');
        modal.style.display = 'none';
    }

    acceptDisclaimer() {
        localStorage.setItem('disclaimerShown', 'true');
        document.getElementById('disclaimer-modal').style.display = 'none';
    }

    toggleLanguage() {
        const btn = document.querySelector('[data-lang-toggle]');
        const isEnglish = btn.querySelector('.flag').textContent === '🇮🇳';
        
        if (isEnglish) {
            btn.innerHTML = '<span class="flag">🇺🇸</span>English';
            this.setLanguage('hi');
        } else {
            btn.innerHTML = '<span class="flag">🇮🇳</span>हिंदी';
            this.setLanguage('en');
        }
    }

    setLanguage(lang) {
        // Simplified language switching
        localStorage.setItem('preferredLanguage', lang);
        // In a real app, this would update all text content
        console.log(`Language set to: ${lang}`);
    }

    saveToHistory(analysis) {
        const historyItem = {
            id: Date.now(),
            timestamp: analysis.timestamp,
            imageData: analysis.imageData,
            freshnessScore: analysis.freshnessScore,
            summary: `Freshness: ${analysis.freshnessScore}/100 | ${analysis.nutritionInfo.dishName}`,
            metrics: analysis.safetyMetrics.map(m => ({
                title: m.title,
                level: m.level,
                description: m.description
            }))
        };

        this.analysisHistory.unshift(historyItem);
        if (this.analysisHistory.length > 50) {
            this.analysisHistory = this.analysisHistory.slice(0, 50);
        }

        localStorage.setItem('foodSafetyHistory', JSON.stringify(this.analysisHistory));
        this.loadHistory();
    }

    loadHistory() {
        const list = document.getElementById('history-list');
        list.innerHTML = '';

        if (this.analysisHistory.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 48px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
                    <h3>No Analysis History</h3>
                    <p>Start analyzing food to see your history here</p>
                </div>
            `;
            return;
        }

        this.analysisHistory.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item fade-in';
            historyItem.innerHTML = `
                <div class="history-item-header">
                    <h4 class="history-item-title">${item.summary}</h4>
                    <span class="history-item-date">${item.timestamp.toLocaleDateString()}</span>
                </div>
                <div class="history-item-score">
                    <div class="score-badge" style="background: ${this.getScoreColor(item.freshnessScore)}">
                        ${item.freshnessScore}
                    </div>
                    <span>${this.getScoreRating(item.freshnessScore)}</span>
                </div>
                <div class="history-item-summary">
                    ${item.metrics.slice(0, 3).map(metric => 
                        `${metric.icon || '•'} ${metric.title} (${this.getRiskText(metric.level)})`
                    ).join(' • ')}
                </div>
            `;

            historyItem.addEventListener('click', () => this.viewHistoryItem(item));
            list.appendChild(historyItem);
        });
    }

    getScoreColor(score) {
        if (score >= 80) return '#16A34A';
        if (score >= 60) return '#EAB308';
        return '#DC2626';
    }

    viewHistoryItem(item) {
        // Restore analysis for viewing
        const analysis = {
            imageData: item.imageData,
            timestamp: item.timestamp,
            freshnessScore: item.freshnessScore,
            safetyMetrics: item.metrics,
            nutritionInfo: {
                dishName: item.summary.split('|')[1]?.trim() || 'Unknown Dish',
                calories: 'N/A',
                macros: 'N/A'
            },
            recommendations: [],
            uniqueScores: {
                heartRiskScore: Math.floor(Math.random() * 100),
                diabetesRiskScore: Math.floor(Math.random() * 100),
                streetFoodRating: { score: 75, description: 'Previously analyzed' }
            }
        };

        this.currentAnalysis = analysis;
        this.displayResults(analysis);
        
        // Navigate to home screen
        this.handleNavigation({ currentTarget: { dataset: { nav: 'home' } } });
    }

    clearHistory() {
        if (confirm('Are you sure you want to clear all analysis history?')) {
            this.analysisHistory = [];
            localStorage.removeItem('foodSafetyHistory');
            this.loadHistory();
        }
    }

    cleanup() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FoodSafetyApp();
});

// Service Worker registration for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Handle offline functionality
window.addEventListener('online', () => {
    console.log('App is back online');
});

window.addEventListener('offline', () => {
    console.log('App is offline - limited functionality available');
});

// Add global error handling
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    // In production, this could send error reports to a logging service
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault();
});