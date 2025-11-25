const tf = require('@tensorflow/tfjs-node');
const FoodSafetyBaseModel = require('./FoodSafetyBaseModel');
const fs = require('fs-extra');
const path = require('path');

/**
 * Food Spoilage Detection Model for Indian Foods
 * Identifies spoiled, moldy, or contaminated food items
 */
class SpoilageModel extends FoodSafetyBaseModel {
  constructor() {
    super({
      modelType: 'spoilage',
      inputShape: [224, 224, 3],
      numClasses: 5, // Fresh, Slightly Stale, Spoiled, Moldy, Dangerous
      classes: [
        'fresh_food',        // Fresh, properly stored food
        'slightly_stale',    // Food starting to lose freshness
        'spoiled_food',      // Food showing spoilage signs
        'moldy_food',        // Visible mold growth
        'dangerous_food'     // Highly contaminated, unsafe food
      ]
    });
  }

  /**
   * Extract spoilage indicators from image
   */
  extractSpoilageFeatures(imageTensor) {
    return tf.tidy(() => {
      // Color analysis for spoilage indicators
      const colorFeatures = this.analyzeSpoilageColors(imageTensor);
      
      // Texture analysis for mold and deterioration
      const textureFeatures = this.analyzeTextureDeterioration(imageTensor);
      
      // Moisture and bacterial growth indicators
      const moistureFeatures = this.analyzeMoistureIndicators(imageTensor);
      
      return tf.concat([colorFeatures, textureFeatures, moistureFeatures], 0);
    });
  }

  /**
   * Analyze color patterns indicating spoilage
   */
  analyzeSpoilageColors(imageTensor) {
    return tf.tidy(() => {
      // Convert to different color spaces for better spoilage detection
      const hsv = tf.image.rgbToHsv(imageTensor);
      const lab = this.rgbToLab(imageTensor);
      
      // Analyze greenish tints (common in spoiled produce)
      const greenMask = hsv.slice([0, 0, 0], [224, 224, 1]).greater(60).logicalAnd(
        hsv.slice([0, 0, 0], [224, 224, 1]).less(180)
      ).logicalAnd(
        hsv.slice([0, 0, 1], [224, 224, 1]).greater(0.3)
      );
      
      const greenPixels = greenMask.sum();
      
      // Analyze brown/black discoloration
      const darkMask = hsv.slice([0, 0, 2], [224, 224, 1]).less(0.4);
      const darkPixels = darkMask.sum();
      
      // Yellow/brown tints (oxidation indicators)
      const yellowMask = hsv.slice([0, 0, 0], [224, 224, 1]).less(60).logicalAnd(
        hsv.slice([0, 0, 0], [224, 224, 1]).greater(20)
      );
      const yellowPixels = yellowMask.sum();
      
      // Calculate color ratios
      const totalPixels = 224 * 224;
      const greenRatio = greenPixels.div(totalPixels);
      const darkRatio = darkPixels.div(totalPixels);
      const yellowRatio = yellowPixels.div(totalPixels);
      
      // Clean up
      hsv.dispose();
      lab.dispose();
      greenMask.dispose();
      greenPixels.dispose();
      darkMask.dispose();
      darkPixels.dispose();
      yellowMask.dispose();
      yellowPixels.dispose();
      
      return tf.tensor([greenRatio.dataSync()[0], darkRatio.dataSync()[0], 
                       yellowRatio.dataSync()[0]]);
    });
  }

  /**
   * Analyze texture deterioration patterns
   */
  analyzeTextureDeterioration(imageTensor) {
    return tf.tidy(() => {
      const grayImage = tf.image.rgbToGrayscale(imageTensor);
      
      // Detect uneven surface texture (common in spoiled food)
      const sobelX = tf.image.sobelEdges(grayImage).slice([0, 0, 0], [224, 224, 1, 1]);
      const sobelY = tf.image.sobelEdges(grayImage).slice([0, 0, 1], [224, 224, 1, 1]);
      
      const edgeMagnitude = tf.sqrt(sobelX.square().add(sobelY.square()));
      
      // Calculate texture irregularity
      const edgeDensity = edgeMagnitude.greater(0.15).mean();
      const textureVariance = edgeMagnitude.sub(edgeMagnitude.mean()).square().mean();
      
      // Detect fuzzy/fuzzy texture (mold indicators)
      const blurredImage = this.applyGaussianBlur(grayImage);
      const sharpnessLoss = grayImage.sub(blurredImage).square().mean();
      
      // Clean up
      grayImage.dispose();
      sobelX.dispose();
      sobelY.dispose();
      edgeMagnitude.dispose();
      blurredImage.dispose();
      
      return tf.tensor([edgeDensity.dataSync()[0], textureVariance.dataSync()[0],
                       sharpnessLoss.dataSync()[0]]);
    });
  }

  /**
   * Analyze moisture indicators and bacterial growth
   */
  analyzeMoistureIndicators(imageTensor) {
    return tf.tidy(() => {
      // Convert to LAB color space for better moisture analysis
      const lab = this.rgbToLab(imageTensor);
      
      // Analyze L channel (brightness) for moisture effects
      const lChannel = lab.slice([0, 0, 0], [224, 224, 1]);
      
      // Moisture typically causes uneven brightness
      const brightnessMean = lChannel.mean();
      const brightnessVariance = lChannel.sub(brightnessMean).square().mean();
      
      // Detect shiny/wet surfaces
      const highlightMask = lChannel.greater(0.8);
      const highlightRatio = highlightMask.mean();
      
      // Clean up
      lab.dispose();
      lChannel.dispose();
      highlightMask.dispose();
      
      return tf.tensor([brightnessMean.dataSync()[0], brightnessVariance.dataSync()[0],
                       highlightRatio.dataSync()[0]]);
    });
  }

  /**
   * Convert RGB to LAB color space
   */
  rgbToLab(rgbImage) {
    return tf.tidy(() => {
      // Simplified RGB to LAB conversion
      const normalized = rgbImage.div(255.0);
      
      // Convert to XYZ first
      const x = normalized.slice([0, 0, 0], [224, 224, 1]).mul(0.4124)
        .add(normalized.slice([0, 0, 1], [224, 224, 1]).mul(0.3576))
        .add(normalized.slice([0, 0, 2], [224, 224, 1]).mul(0.1805));
      
      const y = normalized.slice([0, 0, 0], [224, 224, 1]).mul(0.2126)
        .add(normalized.slice([0, 0, 1], [224, 224, 1]).mul(0.7152))
        .add(normalized.slice([0, 0, 2], [224, 224, 1]).mul(0.0722));
      
      const z = normalized.slice([0, 0, 0], [224, 224, 1]).mul(0.0193)
        .add(normalized.slice([0, 0, 1], [224, 224, 1]).mul(0.1192))
        .add(normalized.slice([0, 0, 2], [224, 224, 1]).mul(0.9505));
      
      // Convert XYZ to LAB (simplified)
      const l = y.mul(116).sub(16);
      const a = x.sub(y).mul(500);
      const b = y.sub(z).mul(200);
      
      return tf.concat([l.expandDims(-1), a.expandDims(-1), b.expandDims(-1)], -1);
    });
  }

  /**
   * Apply Gaussian blur for texture analysis
   */
  applyGaussianBlur(imageTensor) {
    return tf.tidy(() => {
      const kernel = tf.tidy(() => {
        const values = [1, 4, 6, 4, 1];
        const kernel1d = tf.tensor1d(values).div(16);
        const kernel2d = tf.outerProduct(kernel1d, kernel1d);
        return kernel2d.reshape([5, 5, 1, 1]);
      });
      
      const blurred = tf.conv2d(imageTensor.reshape([224, 224, 1]), kernel, 1, 'same');
      
      kernel.dispose();
      return blurred;
    });
  }

  /**
   * Enhanced spoilage prediction
   */
  async predict(imagePath) {
    try {
      const basePrediction = await super.predict(imagePath);
      
      // Extract spoilage specific features
      const preprocessedImage = await this.preprocessImage(imagePath);
      const spoilageFeatures = this.extractSpoilageFeatures(preprocessedImage);
      
      // Calculate spoilage indicators
      const spoilageIndicators = this.calculateSpoilageIndicators(spoilageFeatures);
      
      // Generate comprehensive analysis
      const detailedAnalysis = this.generateSpoilageAnalysis(basePrediction, spoilageIndicators);
      
      // Cleanup
      preprocessedImage.dispose();
      spoilageFeatures.dispose();
      
      return {
        ...basePrediction,
        ...detailedAnalysis,
        spoilageLevel: spoilageIndicators.spoilageLevel,
        healthRiskScore: spoilageIndicators.healthRiskScore,
        safetyRecommendation: spoilageIndicators.recommendation
      };
    } catch (error) {
      throw new Error(`Spoilage prediction failed: ${error.message}`);
    }
  }

  /**
   * Calculate spoilage severity indicators
   */
  calculateSpoilageIndicators(spoilageFeatures) {
    return tf.tidy(() => {
      const features = spoilageFeatures.dataSync();
      
      // Spoilage scoring based on extracted features
      const greenRatio = features[0]; // Green discoloration
      const darkRatio = features[1]; // Dark spots
      const yellowRatio = features[2]; // Yellow/brown tints
      const textureVariance = features[4]; // Texture deterioration
      const brightnessVariance = features[7]; // Moisture indicators
      
      // Calculate composite spoilage score
      const spoilageScore = (
        greenRatio * 0.25 +     // Green mold/rot
        darkRatio * 0.30 +      // Dark discoloration
        yellowRatio * 0.15 +    // Oxidation
        textureVariance * 0.20 + // Texture deterioration
        brightnessVariance * 0.10 // Moisture effects
      );
      
      let spoilageLevel = '';
      let healthRiskScore = 0;
      let recommendation = '';
      
      if (spoilageScore < 0.1) {
        spoilageLevel = 'fresh';
        healthRiskScore = 5;
        recommendation = 'Food is fresh and safe to consume';
      } else if (spoilageScore < 0.25) {
        spoilageLevel = 'slightly_stale';
        healthRiskScore = 25;
        recommendation = 'Food is still safe but consume soon';
      } else if (spoilageScore < 0.5) {
        spoilageLevel = 'spoiled';
        healthRiskScore = 70;
        recommendation = 'Food shows spoilage signs, do not consume';
      } else if (spoilageScore < 0.75) {
        spoilageLevel = 'moldy';
        healthRiskScore = 85;
        recommendation = 'Mold detected, discard immediately';
      } else {
        spoilageLevel = 'dangerous';
        healthRiskScore = 95;
        recommendation = 'Highly contaminated, extreme health risk';
      }
      
      return {
        spoilageLevel,
        healthRiskScore,
        recommendation,
        spoilageScore: spoilageScore * 100
      };
    });
  }

  /**
   * Generate detailed spoilage analysis report
   */
  generateSpoilageAnalysis(basePrediction, spoilageIndicators) {
    const classIndex = basePrediction.class;
    const className = this.modelConfig.classes[classIndex];
    
    const analysis = {
      primaryClass: className,
      confidence: basePrediction.confidence,
      spoilageLevel: spoilageIndicators.spoilageLevel,
      
      specificFindings: [],
      healthRisks: [],
      storageRecommendations: []
    };

    // Generate specific findings based on spoilage level
    switch (className) {
      case 'fresh_food':
        analysis.specificFindings.push('Food maintains natural color and texture');
        analysis.specificFindings.push('No signs of deterioration detected');
        analysis.healthRisks.push('Minimal - food is properly preserved');
        analysis.storageRecommendations.push('Store according to food type requirements');
        break;
        
      case 'slightly_stale':
        analysis.specificFindings.push('Minor color changes from fresh state');
        analysis.specificFindings.push('Slight texture alterations');
        analysis.healthRisks.push('Low risk - still within safe consumption period');
        analysis.storageRecommendations.push('Consume within 1-2 days');
        analysis.storageRecommendations.push('Check for proper refrigeration');
        break;
        
      case 'spoiled_food':
        analysis.specificFindings.push('Visible discoloration and texture changes');
        analysis.specificFindings.push('Signs of bacterial growth');
        analysis.healthRisks.push('Medium to high risk of food poisoning');
        analysis.healthRisks.push('May contain harmful bacteria or toxins');
        analysis.storageRecommendations.push('Do not consume');
        analysis.storageRecommendations.push('Discard immediately');
        break;
        
      case 'moldy_food':
        analysis.specificFindings.push('Visible mold growth detected');
        analysis.specificFindings.push('Fuzzy texture and unusual colors');
        analysis.healthRisks.push('High risk of mycotoxin exposure');
        analysis.healthRisks.push('Potential severe health effects');
        analysis.storageRecommendations.push('Discard entire item');
        analysis.storageRecommendations.push('Check surrounding items for contamination');
        break;
        
      case 'dangerous_food':
        analysis.specificFindings.push('Multiple spoilage indicators present');
        analysis.specificFindings.push('Extreme deterioration and contamination');
        analysis.healthRisks.push('Extreme health risk - do not consume');
        analysis.healthRisks.push('Potential for severe foodborne illness');
        analysis.storageRecommendations.push('Discard immediately');
        analysis.storageRecommendations.push('Sanitize storage area');
        break;
    }

    return analysis;
  }

  /**
   * Custom model architecture for spoilage detection
   */
  buildModel() {
    const model = tf.sequential({
      layers: [
        // Input layer optimized for spoilage detection
        tf.layers.conv2d({
          inputShape: this.inputShape,
          filters: 32,
          kernelSize: 5,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.002 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        // Color analysis layers for discoloration
        tf.layers.conv2d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.002 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        // Texture analysis for deterioration patterns
        tf.layers.conv2d({
          filters: 128,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.002 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        // Mold and bacterial growth detection
        tf.layers.conv2d({
          filters: 256,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.002 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.globalAveragePooling2d(),
        
        // Classification with spoilage awareness
        tf.layers.dense({
          units: 256,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.dropout({ rate: 0.5 }),
        tf.layers.dense({
          units: 128,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.dropout({ rate: 0.4 }),
        tf.layers.dense({
          units: this.numClasses,
          activation: 'softmax'
        })
      ]
    });

    return model;
  }
}

module.exports = SpoilageModel;