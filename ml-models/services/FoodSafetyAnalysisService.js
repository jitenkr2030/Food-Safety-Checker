const fs = require('fs-extra');
const path = require('path');
const OilQualityModel = require('../models/OilQualityModel');
const BurntFoodModel = require('../models/BurntFoodModel');
const SpoilageModel = require('../models/SpoilageModel');
const NutritionalModel = require('../models/NutritionalModel');
const SaltSugarModel = require('../models/SaltSugarModel');
const TemperatureSafetyModel = require('../models/TemperatureSafetyModel');
const ChemicalAdditiveModel = require('../models/ChemicalAdditiveModel');
const MicroplasticsModel = require('../models/MicroplasticsModel');

/**
 * Comprehensive Food Safety Analysis Service
 * Integrates all 8 ML models for complete food safety assessment
 */
class FoodSafetyAnalysisService {
  constructor() {
    this.models = {
      oilQuality: new OilQualityModel(),
      burntFood: new BurntFoodModel(),
      spoilage: new SpoilageModel(),
      nutritional: new NutritionalModel(),
      saltSugar: new SaltSugarModel(),
      temperature: new TemperatureSafetyModel(),
      chemical: new ChemicalAdditiveModel(),
      microplastics: new MicroplasticsModel()
    };
    this.isInitialized = false;
  }

  /**
   * Initialize all models
   */
  async initialize() {
    try {
      console.log('🔄 Initializing Food Safety Analysis Service...');
      
      // Load pre-trained models
      for (const [name, model] of Object.entries(this.models)) {
        try {
          await model.loadModel();
          console.log(`✅ ${name} model loaded`);
        } catch (error) {
          console.warn(`⚠️  ${name} model not found, will train when needed`);
        }
      }
      
      this.isInitialized = true;
      console.log('🎉 Food Safety Analysis Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Food Safety Analysis Service:', error);
      throw error;
    }
  }

  /**
   * Comprehensive food safety analysis
   */
  async analyzeFood(imagePath, userPreferences = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`🔍 Analyzing food safety: ${imagePath}`);
      
      // Run all safety checks in parallel
      const analysisResults = await this.runAllAnalyses(imagePath);
      
      // Calculate overall safety score
      const overallSafety = this.calculateOverallSafety(analysisResults);
      
      // Generate comprehensive report
      const comprehensiveReport = this.generateComprehensiveReport(
        analysisResults, 
        overallSafety, 
        userPreferences
      );
      
      // Save analysis results
      const analysisId = await this.saveAnalysisResults(comprehensiveReport);
      
      return {
        analysisId,
        ...comprehensiveReport,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Food safety analysis failed:', error);
      throw new Error(`Food safety analysis failed: ${error.message}`);
    }
  }

  /**
   * Run all 8 safety analyses in parallel
   */
  async runAllAnalyses(imagePath) {
    const analysisPromises = {
      oilQuality: this.models.oilQuality.predict(imagePath).catch(err => ({
        error: err.message,
        class: 'error',
        confidence: 0
      })),
      
      burntFood: this.models.burntFood.predict(imagePath).catch(err => ({
        error: err.message,
        class: 'error',
        confidence: 0
      })),
      
      spoilage: this.models.spoilage.predict(imagePath).catch(err => ({
        error: err.message,
        class: 'error',
        confidence: 0
      })),
      
      nutritional: this.models.nutritional.predict(imagePath).catch(err => ({
        error: err.message,
        nutritionalProfile: null,
        healthScore: 0
      })),
      
      saltSugar: this.models.saltSugar.predict(imagePath).catch(err => ({
        error: err.message,
        saltSugarProfile: null,
        healthScore: 0
      })),
      
      temperature: this.models.temperature.predict(imagePath).catch(err => ({
        error: err.message,
        temperatureProfile: null,
        safetyLevel: 'unknown'
      })),
      
      chemical: this.models.chemical.predict(imagePath).catch(err => ({
        error: err.message,
        chemicalProfile: null,
        riskLevel: 'unknown'
      })),
      
      microplastics: this.models.microplastics.predict(imagePath).catch(err => ({
        error: err.message,
        microplasticProfile: null,
        riskLevel: 'unknown'
      }))
    };

    const results = await Promise.all(Object.values(analysisPromises));
    
    // Map results back to their keys
    const analysisResults = {};
    const keys = Object.keys(analysisPromises);
    results.forEach((result, index) => {
      analysisResults[keys[index]] = result;
    });

    return analysisResults;
  }

  /**
   * Calculate overall safety score based on all analyses
   */
  calculateOverallSafety(analysisResults) {
    const scores = [];
    const weights = {
      oilQuality: 0.15,
      burntFood: 0.20,
      spoilage: 0.25,
      nutritional: 0.10,
      saltSugar: 0.10,
      temperature: 0.10,
      chemical: 0.05,
      microplastics: 0.05
    };

    // Calculate safety scores for each category
    Object.entries(weights).forEach(([category, weight]) => {
      const result = analysisResults[category];
      let categoryScore = 100; // Default to safe

      if (result.error) {
        categoryScore = 50; // Neutral if analysis failed
      } else {
        switch (category) {
          case 'oilQuality':
            if (result.qualityScore !== undefined) {
              categoryScore = result.qualityScore;
            } else if (result.class === 'fresh_oil') categoryScore = 90;
            else if (result.class === 'slightly_used_oil') categoryScore = 70;
            else if (result.class === 'highly_used_oil') categoryScore = 40;
            else if (result.class === 'adulterated_oil') categoryScore = 20;
            else if (result.class === 'dangerous_oil') categoryScore = 5;
            break;
            
          case 'burntFood':
            if (result.healthRiskScore !== undefined) {
              categoryScore = 100 - result.healthRiskScore;
            } else if (result.class === 'fresh_food') categoryScore = 90;
            else if (result.class === 'slightly_overcooked') categoryScore = 70;
            else if (result.class === 'burnt_food') categoryScore = 30;
            else if (result.class === 'severely_burnt') categoryScore = 5;
            break;
            
          case 'spoilage':
            if (result.healthRiskScore !== undefined) {
              categoryScore = 100 - result.healthRiskScore;
            } else if (result.class === 'fresh_food') categoryScore = 95;
            else if (result.class === 'slightly_stale') categoryScore = 75;
            else if (result.class === 'spoiled_food') categoryScore = 20;
            else if (result.class === 'moldy_food') categoryScore = 5;
            else if (result.class === 'dangerous_food') categoryScore = 0;
            break;
            
          case 'nutritional':
            if (result.healthScore !== undefined) {
              categoryScore = result.healthScore;
            }
            break;
            
          case 'saltSugar':
            if (result.healthScore !== undefined) {
              categoryScore = result.healthScore;
            }
            break;
            
          case 'temperature':
            if (result.safetyLevel === 'safe') categoryScore = 90;
            else if (result.safetyLevel === 'caution') categoryScore = 60;
            else if (result.safetyLevel === 'unsafe') categoryScore = 20;
            break;
            
          case 'chemical':
            if (result.riskLevel === 'low') categoryScore = 85;
            else if (result.riskLevel === 'moderate') categoryScore = 60;
            else if (result.riskLevel === 'high') categoryScore = 30;
            break;
            
          case 'microplastics':
            if (result.riskLevel === 'low_risk') categoryScore = 85;
            else if (result.riskLevel === 'moderate_risk') categoryScore = 60;
            else if (result.riskLevel === 'high_risk') categoryScore = 30;
            else if (result.riskLevel === 'critical_risk') categoryScore = 10;
            break;
        }
      }

      scores.push(categoryScore * weight);
    });

    const overallScore = Math.round(scores.reduce((sum, score) => sum + score, 0));
    
    let safetyLevel = 'excellent';
    if (overallScore >= 90) safetyLevel = 'excellent';
    else if (overallScore >= 75) safetyLevel = 'good';
    else if (overallScore >= 60) safetyLevel = 'acceptable';
    else if (overallScore >= 40) safetyLevel = 'concerning';
    else if (overallScore >= 20) safetyLevel = 'dangerous';
    else safetyLevel = 'unsafe';

    return {
      overallScore,
      safetyLevel,
      categoryScores: Object.keys(weights).reduce((acc, category) => {
        const result = analysisResults[category];
        let score = 50; // Default score
        
        if (!result.error) {
          switch (category) {
            case 'oilQuality':
              score = result.qualityScore || 50;
              break;
            case 'burntFood':
              score = result.healthRiskScore ? 100 - result.healthRiskScore : 50;
              break;
            case 'spoilage':
              score = result.healthRiskScore ? 100 - result.healthRiskScore : 50;
              break;
            case 'nutritional':
            case 'saltSugar':
              score = result.healthScore || 50;
              break;
            case 'temperature':
              score = result.safetyLevel === 'safe' ? 90 : 
                     result.safetyLevel === 'caution' ? 60 : 20;
              break;
            case 'chemical':
            case 'microplastics':
              score = result.riskLevel === 'low' ? 85 :
                     result.riskLevel === 'moderate' ? 60 :
                     result.riskLevel === 'high' ? 30 : 10;
              break;
          }
        }
        
        acc[category] = Math.round(score);
        return acc;
      }, {})
    };
  }

  /**
   * Generate comprehensive safety report
   */
  generateComprehensiveReport(analysisResults, overallSafety, userPreferences) {
    const report = {
      overall: {
        safetyScore: overallSafety.overallScore,
        safetyLevel: overallSafety.safetyLevel,
        categoryScores: overallSafety.categoryScores,
        recommendation: this.getOverallRecommendation(overallSafety.safetyLevel)
      },
      
      detailedAnalysis: {
        oilQuality: this.summarizeOilQuality(analysisResults.oilQuality),
        burntFood: this.summarizeBurntFood(analysisResults.burntFood),
        spoilage: this.summarizeSpoilage(analysisResults.spoilage),
        nutritional: this.summarizeNutritional(analysisResults.nutritional),
        saltSugar: this.summarizeSaltSugar(analysisResults.saltSugar),
        temperature: this.summarizeTemperature(analysisResults.temperature),
        chemical: this.summarizeChemical(analysisResults.chemical),
        microplastics: this.summarizeMicroplastics(analysisResults.microplastics)
      },
      
      healthInsights: this.generateHealthInsights(analysisResults, userPreferences),
      safetyAlerts: this.generateSafetyAlerts(analysisResults),
      recommendations: this.generateRecommendations(analysisResults, overallSafety, userPreferences)
    };

    return report;
  }

  /**
   * Get overall safety recommendation
   */
  getOverallRecommendation(safetyLevel) {
    switch (safetyLevel) {
      case 'excellent':
        return 'This food is excellent and safe for consumption. Enjoy!';
      case 'good':
        return 'This food is good and safe with minor considerations.';
      case 'acceptable':
        return 'This food is acceptable but consider the noted concerns.';
      case 'concerning':
        return 'This food has concerning safety issues. Use with caution.';
      case 'dangerous':
        return 'This food has dangerous safety issues. Consider alternatives.';
      case 'unsafe':
        return 'This food is unsafe and not recommended for consumption.';
      default:
        return 'Unable to determine safety status.';
    }
  }

  /**
   * Generate health insights based on analysis results
   */
  generateHealthInsights(analysisResults, userPreferences) {
    const insights = [];
    
    // Nutritional insights
    if (analysisResults.nutritional?.healthScore) {
      if (analysisResults.nutritional.healthScore >= 80) {
        insights.push('Excellent nutritional profile with balanced macronutrients');
      } else if (analysisResults.nutritional.healthScore >= 60) {
        insights.push('Good nutritional value with room for improvement');
      } else {
        insights.push('Consider adding more nutritious components to balance the meal');
      }
    }
    
    // Salt/Sugar insights
    if (analysisResults.saltSugar?.saltSugarProfile) {
      const { saltLevel, sugarLevel } = analysisResults.saltSugar.saltSugarProfile;
      if (saltLevel > 600) {
        insights.push('High sodium content - may affect blood pressure');
      }
      if (sugarLevel > 5000) {
        insights.push('High sugar content - monitor for blood sugar impact');
      }
    }
    
    // Temperature insights
    if (analysisResults.temperature?.riskLevel === 'high') {
      insights.push('Temperature safety concern - food in danger zone');
    }
    
    // Microplastics insights
    if (analysisResults.microplastics?.riskLevel === 'high_risk' || 
        analysisResults.microplastics?.riskLevel === 'critical_risk') {
      insights.push('Microplastic contamination risk detected - consider filtration');
    }

    return insights;
  }

  /**
   * Generate safety alerts for critical issues
   */
  generateSafetyAlerts(analysisResults) {
    const alerts = [];
    
    if (analysisResults.oilQuality?.class === 'dangerous_oil') {
      alerts.push({
        level: 'critical',
        message: 'Dangerous oil quality detected - immediate health risk',
        action: 'Do not consume this food'
      });
    }
    
    if (analysisResults.burntFood?.class === 'severely_burnt') {
      alerts.push({
        level: 'critical',
        message: 'Severely burnt food detected - carcinogenic compounds likely',
        action: 'Discard food immediately'
      });
    }
    
    if (analysisResults.spoilage?.class === 'dangerous_food') {
      alerts.push({
        level: 'critical',
        message: 'Dangerous contamination detected',
        action: 'Do not consume - severe health risk'
      });
    }
    
    if (analysisResults.chemical?.class === 'harmful_chemicals') {
      alerts.push({
        level: 'high',
        message: 'Harmful chemicals detected in food',
        action: 'Avoid consumption and report to authorities'
      });
    }
    
    if (analysisResults.microplastics?.riskLevel === 'critical_risk') {
      alerts.push({
        level: 'high',
        message: 'Critical microplastic contamination risk',
        action: 'Do not consume - high exposure risk'
      });
    }

    return alerts;
  }

  /**
   * Generate personalized recommendations
   */
  generateRecommendations(analysisResults, overallSafety, userPreferences) {
    const recommendations = [];
    
    // Overall safety recommendations
    if (overallSafety.safetyLevel === 'concerning' || 
        overallSafety.safetyLevel === 'dangerous' || 
        overallSafety.safetyLevel === 'unsafe') {
      recommendations.push('Consider alternative food options');
      recommendations.push('If consumed, monitor for any adverse reactions');
    }
    
    // Category-specific recommendations
    if (analysisResults.oilQuality?.recommendation) {
      recommendations.push(`Oil Quality: ${analysisResults.oilQuality.recommendation}`);
    }
    
    if (analysisResults.burntFood?.recommendation) {
      recommendations.push(`Cooking Safety: ${analysisResults.burntFood.recommendation}`);
    }
    
    if (analysisResults.spoilage?.recommendation) {
      recommendations.push(`Freshness: ${analysisResults.spoilage.recommendation}`);
    }
    
    if (analysisResults.temperature?.handlingRecommendations) {
      analysisResults.temperature.handlingRecommendations.forEach(rec => {
        recommendations.push(`Temperature: ${rec}`);
      });
    }
    
    // User preference-based recommendations
    if (userPreferences?.healthConditions) {
      if (userPreferences.healthConditions.includes('diabetes') && 
          analysisResults.saltSugar?.saltSugarProfile?.sugarLevel > 3000) {
        recommendations.push('High sugar content - not suitable for diabetic diet');
      }
      
      if (userPreferences.healthConditions.includes('hypertension') && 
          analysisResults.saltSugar?.saltSugarProfile?.saltLevel > 400) {
        recommendations.push('High sodium content - not suitable for hypertensive diet');
      }
    }
    
    return recommendations;
  }

  /**
   * Save analysis results to database
   */
  async saveAnalysisResults(report) {
    try {
      // This would save to the database through the existing FoodAnalysis model
      // For now, we'll return a mock analysis ID
      return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    } catch (error) {
      console.error('Failed to save analysis results:', error);
      throw error;
    }
  }

  /**
   * Get analysis history for a user
   */
  async getAnalysisHistory(userId, limit = 10) {
    try {
      // This would query the database through the existing models
      // For now, return mock data
      return [];
    } catch (error) {
      console.error('Failed to get analysis history:', error);
      throw error;
    }
  }

  // Summary methods for each analysis type
  summarizeOilQuality(result) {
    if (result.error) return { error: result.error };
    return {
      status: result.class,
      confidence: result.confidence,
      qualityScore: result.qualityScore,
      keyFindings: result.specificFindings || [],
      recommendation: result.safetyRecommendation
    };
  }

  summarizeBurntFood(result) {
    if (result.error) return { error: result.error };
    return {
      status: result.class,
      confidence: result.confidence,
      severityLevel: result.severityLevel,
      healthRiskScore: result.healthRiskScore,
      keyFindings: result.specificFindings || [],
      recommendation: result.safetyRecommendation
    };
  }

  summarizeSpoilage(result) {
    if (result.error) return { error: result.error };
    return {
      status: result.class,
      confidence: result.confidence,
      spoilageLevel: result.spoilageLevel,
      healthRiskScore: result.healthRiskScore,
      keyFindings: result.specificFindings || [],
      recommendation: result.safetyRecommendation
    };
  }

  summarizeNutritional(result) {
    if (result.error || !result.nutritionalProfile) return { error: result?.error };
    return {
      healthScore: result.healthScore,
      calories: result.nutritionalProfile.calories,
      macronutrients: {
        protein: result.nutritionalProfile.protein,
        carbs: result.nutritionalProfile.carbs,
        fat: result.nutritionalProfile.fat,
        fiber: result.nutritionalProfile.fiber
      },
      healthInsights: result.healthInsights || []
    };
  }

  summarizeSaltSugar(result) {
    if (result.error || !result.saltSugarProfile) return { error: result?.error };
    return {
      healthScore: result.healthScore,
      saltLevel: result.saltSugarProfile.saltLevel,
      sugarLevel: result.saltSugarProfile.sugarLevel,
      riskLevel: result.saltSugarProfile.riskLevel,
      primaryFindings: result.primaryFindings || []
    };
  }

  summarizeTemperature(result) {
    if (result.error || !result.temperatureProfile) return { error: result?.error };
    return {
      temperature: result.temperatureProfile.estimatedTemperature,
      safetyLevel: result.safetyLevel,
      riskLevel: result.riskLevel,
      safetyFindings: result.safetyFindings || [],
      recommendations: result.handlingRecommendations || []
    };
  }

  summarizeChemical(result) {
    if (result.error || !result.chemicalProfile) return { error: result?.error };
    return {
      classification: result.chemicalProfile.classification,
      riskLevel: result.riskLevel,
      confidence: result.confidence,
      specificFindings: result.specificFindings || [],
      healthConcerns: result.healthConcerns || [],
      recommendations: result.recommendations || []
    };
  }

  summarizeMicroplastics(result) {
    if (result.error || !result.microplasticProfile) return { error: result?.error };
    return {
      riskLevel: result.riskLevel,
      riskScore: result.riskScore,
      confidence: result.confidence,
      contaminationFindings: result.contaminationFindings || [],
      healthConcerns: result.healthConcerns || [],
      preventionRecommendations: result.preventionRecommendations || []
    };
  }

  /**
   * Clean up resources
   */
  dispose() {
    Object.values(this.models).forEach(model => {
      if (model.dispose) {
        model.dispose();
      }
    });
  }
}

module.exports = FoodSafetyAnalysisService;