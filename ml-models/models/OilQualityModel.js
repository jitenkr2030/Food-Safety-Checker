const tf = require('@tensorflow/tfjs-node');
const FoodSafetyBaseModel = require('./FoodSafetyBaseModel');
const fs = require('fs-extra');
const path = require('path');

/**
 * Oil Quality Detection Model for Indian Foods
 * Detects adulteration, freshness, and safety of cooking oils used in Indian cuisine
 */
class OilQualityModel extends FoodSafetyBaseModel {
  constructor() {
    super({
      modelType: 'oil_quality',
      inputShape: [224, 224, 3],
      numClasses: 5, // Fresh, Slightly Used, Highly Used, Adulterated, Dangerous
      classes: [
        'fresh_oil',           // Fresh cooking oil
        'slightly_used_oil',   // Oil used 1-3 times
        'highly_used_oil',     // Oil used 4+ times
        'adulterated_oil',     // Oil mixed with cheaper alternatives
        'dangerous_oil'        // Oil showing signs of degradation
      ]
    });
  }

  /**
   * Extract oil-specific features from image
   */
  extractOilFeatures(imageTensor) {
    return tf.tidy(() => {
      // Color analysis for oil quality
      const colorFeatures = this.analyzeOilColor(imageTensor);
      
      // Texture analysis for oil consistency
      const textureFeatures = this.analyzeOilTexture(imageTensor);
      
      // Detect adulteration indicators
      const adulterationFeatures = this.detectAdulteration(imageTensor);
      
      return tf.concat([colorFeatures, textureFeatures, adulterationFeatures], 0);
    });
  }

  /**
   * Analyze oil color characteristics
   */
  analyzeOilColor(imageTensor) {
    return tf.tidy(() => {
      // Convert to different color spaces
      const hsv = tf.image.rgbToHsv(imageTensor);
      
      // Extract key color metrics
      const hue = hsv.slice([0, 0, 0], [224, 224, 1]);
      const saturation = hsv.slice([0, 0, 1], [224, 224, 1]);
      const value = hsv.slice([0, 0, 2], [224, 224, 1]);
      
      // Calculate statistics for color quality indicators
      const hueMean = hue.mean();
      const hueVariance = hue.sub(hueMean).square().mean();
      
      const saturationMean = saturation.mean();
      const saturationVariance = saturation.sub(saturationMean).square().mean();
      
      const valueMean = value.mean();
      const valueVariance = value.sub(valueMean).square().mean();
      
      // Clean up intermediate tensors
      hsv.dispose();
      hue.dispose();
      saturation.dispose();
      value.dispose();
      
      return tf.tensor([hueMean.dataSync()[0], hueVariance.dataSync()[0], 
                       saturationMean.dataSync()[0], saturationVariance.dataSync()[0],
                       valueMean.dataSync()[0], valueVariance.dataSync()[0]]);
    });
  }

  /**
   * Analyze oil texture and consistency
   */
  analyzeOilTexture(imageTensor) {
    return tf.tidy(() => {
      // Edge detection for texture analysis
      const grayImage = tf.image.rgbToGrayscale(imageTensor);
      const gradient = tf.image.sobelEdges(grayImage);
      
      // Calculate texture metrics
      const edgeMagnitude = gradient.square().sum(-1).sqrt();
      const edgeMean = edgeMagnitude.mean();
      const edgeVariance = edgeMagnitude.sub(edgeMean).square().mean();
      
      // Clean up
      grayImage.dispose();
      gradient.dispose();
      edgeMagnitude.dispose();
      
      return tf.tensor([edgeMean.dataSync()[0], edgeVariance.dataSync()[0]]);
    });
  }

  /**
   * Detect potential adulteration indicators
   */
  detectAdulteration(imageTensor) {
    return tf.tidy(() => {
      // Look for unusual color patterns that indicate adulteration
      const redChannel = imageTensor.slice([0, 0, 0], [224, 224, 1]);
      const greenChannel = imageTensor.slice([0, 0, 1], [224, 224, 1]);
      const blueChannel = imageTensor.slice([0, 0, 2], [224, 224, 1]);
      
      // Check for unusual color ratios
      const redGreenRatio = redChannel.div(greenChannel.add(1e-7));
      const blueGreenRatio = blueChannel.div(greenChannel.add(1e-7));
      
      const ratioMean = redGreenRatio.mean();
      const blueRatioMean = blueGreenRatio.mean();
      
      // Clean up
      redChannel.dispose();
      greenChannel.dispose();
      blueChannel.dispose();
      redGreenRatio.dispose();
      blueGreenRatio.dispose();
      
      return tf.tensor([ratioMean.dataSync()[0], blueRatioMean.dataSync()[0]]);
    });
  }

  /**
   * Enhanced oil quality prediction with Indian food context
   */
  async predict(imagePath) {
    try {
      const basePrediction = await super.predict(imagePath);
      
      // Enhance with oil-specific analysis
      const preprocessedImage = await this.preprocessImage(imagePath);
      const oilFeatures = this.extractOilFeatures(preprocessedImage);
      
      // Process oil quality indicators
      const qualityIndicators = this.calculateQualityIndicators(oilFeatures);
      
      // Generate detailed analysis
      const detailedAnalysis = this.generateOilAnalysis(basePrediction, qualityIndicators);
      
      // Cleanup
      preprocessedImage.dispose();
      oilFeatures.dispose();
      
      return {
        ...basePrediction,
        ...detailedAnalysis,
        qualityScore: qualityIndicators.qualityScore,
        safetyRecommendation: qualityIndicators.recommendation
      };
    } catch (error) {
      throw new Error(`Oil quality prediction failed: ${error.message}`);
    }
  }

  /**
   * Calculate quality indicators from extracted features
   */
  calculateQualityIndicators(oilFeatures) {
    return tf.tidy(() => {
      const features = oilFeatures.dataSync();
      
      // Quality scoring based on extracted features
      // Fresh oil typically has: stable hue, lower saturation variance, normal color ratios
      const hueStability = 1 - Math.min(features[1], 1); // Lower variance is better
      const saturationNormal = 1 - Math.min(Math.abs(features[2] - 0.3), 1); // Expected saturation range
      const colorRatios = 1 - Math.min(features[6] + features[7], 1); // Normal color ratios
      
      const qualityScore = (hueStability * 0.3 + saturationNormal * 0.4 + colorRatios * 0.3) * 100;
      
      let recommendation = '';
      if (qualityScore >= 80) {
        recommendation = 'Oil is fresh and safe for cooking';
      } else if (qualityScore >= 60) {
        recommendation = 'Oil shows signs of use but is still acceptable';
      } else if (qualityScore >= 40) {
        recommendation = 'Oil should be replaced soon';
      } else {
        recommendation = 'Oil is degraded and unsafe for consumption';
      }
      
      return {
        qualityScore: Math.round(qualityScore),
        recommendation,
        indicators: {
          hueStability: hueStability,
          saturationNormal: saturationNormal,
          colorRatios: colorRatios
        }
      };
    });
  }

  /**
   * Generate detailed oil analysis report
   */
  generateOilAnalysis(basePrediction, qualityIndicators) {
    const classIndex = basePrediction.class;
    const className = this.modelConfig.classes[classIndex];
    
    const analysis = {
      primaryClass: className,
      confidence: basePrediction.confidence,
      qualityLevel: qualityIndicators.qualityScore >= 80 ? 'excellent' : 
                    qualityIndicators.qualityScore >= 60 ? 'good' :
                    qualityIndicators.qualityScore >= 40 ? 'fair' : 'poor',
      
      specificFindings: [],
      healthImpact: '',
      usageRecommendation: ''
    };

    // Generate specific findings based on class and confidence
    switch (className) {
      case 'fresh_oil':
        analysis.specificFindings.push('Oil has normal color and clarity');
        analysis.specificFindings.push('No signs of degradation detected');
        analysis.healthImpact = 'Safe for consumption';
        analysis.usageRecommendation = 'Can be used for cooking immediately';
        break;
        
      case 'slightly_used_oil':
        analysis.specificFindings.push('Oil shows minimal signs of use');
        analysis.specificFindings.push('Color slightly darkened from fresh state');
        analysis.healthImpact = 'Still safe with some degradation';
        analysis.usageRecommendation = 'Suitable for moderate cooking temperatures';
        break;
        
      case 'highly_used_oil':
        analysis.specificFindings.push('Oil shows significant signs of reuse');
        analysis.specificFindings.push('Notable color and texture changes');
        analysis.healthImpact = 'Increased harmful compound formation risk';
        analysis.usageRecommendation = 'Should be replaced, or used only for high-temperature cooking';
        break;
        
      case 'adulterated_oil':
        analysis.specificFindings.push('Unusual color patterns detected');
        analysis.specificFindings.push('Potential mixing with lower quality oils');
        analysis.healthImpact = 'Potential health risks from unknown additives';
        analysis.usageRecommendation = 'Replace immediately, source from trusted vendors';
        break;
        
      case 'dangerous_oil':
        analysis.specificFindings.push('Severe degradation indicators present');
        analysis.specificFindings.push('High levels of harmful compounds likely');
        analysis.healthImpact = 'Dangerous - do not consume';
        analysis.usageRecommendation = 'Dispose immediately and replace oil';
        break;
    }

    return analysis;
  }

  /**
   * Custom model architecture for oil quality
   */
  buildModel() {
    const model = tf.sequential({
      layers: [
        // Input layer for oil analysis
        tf.layers.conv2d({
          inputShape: this.inputShape,
          filters: 32,
          kernelSize: 5,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.002 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        // Color analysis block
        tf.layers.conv2d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.002 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        // Texture analysis block
        tf.layers.conv2d({
          filters: 128,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.002 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        // Adulteration detection block
        tf.layers.conv2d({
          filters: 256,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.002 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.globalAveragePooling2d(),
        
        // Classification layers
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
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: this.numClasses,
          activation: 'softmax'
        })
      ]
    });

    return model;
  }
}

module.exports = OilQualityModel;