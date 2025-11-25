const tf = require('@tensorflow/tfjs-node');
const FoodSafetyBaseModel = require('./FoodSafetyBaseModel');
const fs = require('fs-extra');
const path = require('path');

/**
 * Burnt Food Detection Model for Indian Cuisine
 * Identifies burnt, overcooked, or charred food that may contain harmful compounds
 */
class BurntFoodModel extends FoodSafetyBaseModel {
  constructor() {
    super({
      modelType: 'burnt_food',
      inputShape: [224, 224, 3],
      numClasses: 4, // Fresh, Slightly Overcooked, Burnt, Severely Burnt
      classes: [
        'fresh_food',        // Freshly cooked, optimal cooking
        'slightly_overcooked', // Minor browning, still safe
        'burnt_food',        // Charred areas, potential harmful compounds
        'severely_burnt'     // Extensive burning, dangerous for consumption
      ]
    });
  }

  /**
   * Extract burnt food indicators from image
   */
  extractBurntFeatures(imageTensor) {
    return tf.tidy(() => {
      // Color analysis for burning indicators
      const colorFeatures = this.analyzeBurningColors(imageTensor);
      
      // Texture analysis for charring patterns
      const textureFeatures = this.analyzeCharringPatterns(imageTensor);
      
      // Smoke and carbon residue detection
      const carbonFeatures = this.detectCarbonResidue(imageTensor);
      
      return tf.concat([colorFeatures, textureFeatures, carbonFeatures], 0);
    });
  }

  /**
   * Analyze color patterns indicating burning
   */
  analyzeBurningColors(imageTensor) {
    return tf.tidy(() => {
      // Convert to HSV for better color analysis
      const hsv = tf.image.rgbToHsv(imageTensor);
      
      // Focus on dark colors (burnt areas)
      const darkMask = hsv.slice([0, 0, 2], [224, 224, 1]).less(0.3);
      const darkPixels = imageTensor.mul(darkMask.expandDims(-1));
      
      // Analyze burnt color characteristics
      const redChannel = darkPixels.slice([0, 0, 0], [224, 224, 1]);
      const greenChannel = darkPixels.slice([0, 0, 1], [224, 224, 1]);
      const blueChannel = darkPixels.slice([0, 0, 2], [224, 224, 1]);
      
      // Calculate burn indicators
      const avgRed = redChannel.mean();
      const avgGreen = greenChannel.mean();
      const avgBlue = blueChannel.mean();
      
      // Burnt food typically shows dark red/brown/black colors
      const burnIndicator1 = avgRed.sub(avgGreen).div(avgGreen.add(1e-7)); // Red dominance
      const burnIndicator2 = avgBlue.div(avgGreen.add(1e-7)); // Blue suppression
      
      // Calculate darkness level
      const grayscale = tf.image.rgbToGrayscale(imageTensor);
      const darknessLevel = grayscale.mean();
      
      // Clean up
      hsv.dispose();
      darkMask.dispose();
      darkPixels.dispose();
      redChannel.dispose();
      greenChannel.dispose();
      blueChannel.dispose();
      grayscale.dispose();
      
      return tf.tensor([avgRed.dataSync()[0], avgGreen.dataSync()[0], avgBlue.dataSync()[0],
                       burnIndicator1.dataSync()[0], burnIndicator2.dataSync()[0],
                       darknessLevel.dataSync()[0]]);
    });
  }

  /**
   * Analyze texture patterns for charring
   */
  analyzeCharringPatterns(imageTensor) {
    return tf.tidy(() => {
      // Edge detection for rough, charred surfaces
      const grayImage = tf.image.rgbToGrayscale(imageTensor);
      
      // Sobel edges for texture analysis
      const sobelX = tf.image.sobelEdges(grayImage).slice([0, 0, 0], [224, 224, 1, 1]);
      const sobelY = tf.image.sobelEdges(grayImage).slice([0, 0, 1], [224, 224, 1, 1]);
      
      const edgeMagnitude = tf.sqrt(sobelX.square().add(sobelY.square()));
      
      // Calculate texture roughness indicators
      const edgeDensity = edgeMagnitude.greater(0.1).mean(); // Density of high edges
      const edgeVariance = edgeMagnitude.sub(edgeMagnitude.mean()).square().mean();
      
      // Calculate local variance for texture irregularity
      const localVariance = this.calculateLocalVariance(grayImage);
      
      // Clean up
      grayImage.dispose();
      sobelX.dispose();
      sobelY.dispose();
      edgeMagnitude.dispose();
      localVariance.dispose();
      
      return tf.tensor([edgeDensity.dataSync()[0], edgeVariance.dataSync()[0]]);
    });
  }

  /**
   * Calculate local variance for texture analysis
   */
  calculateLocalVariance(imageTensor) {
    return tf.tidy(() => {
      const kernel = tf.tidy(() => {
        // 5x5 Gaussian kernel for local variance calculation
        const values = [1, 4, 6, 4, 1];
        const kernel1d = tf.tensor1d(values).div(16);
        const kernel2d = tf.outerProduct(kernel1d, kernel1d);
        return kernel2d.reshape([5, 5, 1, 1]);
      });
      
      // Apply convolution
      const smoothed = tf.conv2d(imageTensor.reshape([224, 224, 1]), kernel, 1, 'same');
      const squared = imageTensor.reshape([224, 224, 1]).square();
      const squaredSmoothed = tf.conv2d(squared, kernel, 1, 'same');
      
      // Local variance = E[X²] - (E[X])²
      const localVar = squaredSmoothed.sub(smoothed.square());
      
      const varianceMean = localVar.mean();
      
      // Clean up
      kernel.dispose();
      smoothed.dispose();
      squared.dispose();
      squaredSmoothed.dispose();
      localVar.dispose();
      
      return varianceMean;
    });
  }

  /**
   * Detect carbon residue and charring
   */
  detectCarbonResidue(imageTensor) {
    return tf.tidy(() => {
      // Look for carbon-black characteristics
      const grayscale = tf.image.rgbToGrayscale(imageTensor);
      
      // Detect very dark areas (potential carbon)
      const carbonMask = grayscale.less(0.2);
      const carbonPixels = carbonMask.sum();
      
      // Calculate carbon coverage ratio
      const totalPixels = 224 * 224;
      const carbonRatio = carbonPixels.div(totalPixels);
      
      // Analyze brightness distribution
      const brightnessMean = grayscale.mean();
      const brightnessStd = grayscale.sub(brightnessMean).square().mean().sqrt();
      
      // Clean up
      grayscale.dispose();
      carbonMask.dispose();
      carbonPixels.dispose();
      
      return tf.tensor([carbonRatio.dataSync()[0], brightnessMean.dataSync()[0], 
                       brightnessStd.dataSync()[0]]);
    });
  }

  /**
   * Enhanced burnt food prediction
   */
  async predict(imagePath) {
    try {
      const basePrediction = await super.predict(imagePath);
      
      // Extract burnt food specific features
      const preprocessedImage = await this.preprocessImage(imagePath);
      const burntFeatures = this.extractBurntFeatures(preprocessedImage);
      
      // Calculate burning severity indicators
      const severityIndicators = this.calculateBurningSeverity(burntFeatures);
      
      // Generate comprehensive analysis
      const detailedAnalysis = this.generateBurntFoodAnalysis(basePrediction, severityIndicators);
      
      // Cleanup
      preprocessedImage.dispose();
      burntFeatures.dispose();
      
      return {
        ...basePrediction,
        ...detailedAnalysis,
        severityLevel: severityIndicators.severityLevel,
        healthRiskScore: severityIndicators.healthRiskScore,
        safetyRecommendation: severityIndicators.recommendation
      };
    } catch (error) {
      throw new Error(`Burnt food prediction failed: ${error.message}`);
    }
  }

  /**
   * Calculate burning severity indicators
   */
  calculateBurningSeverity(burntFeatures) {
    return tf.tidy(() => {
      const features = burntFeatures.dataSync();
      
      // Severity scoring based on extracted features
      const darknessLevel = features[5]; // From color analysis
      const carbonRatio = features[8]; // From carbon detection
      const edgeVariance = features[6]; // From texture analysis
      
      // Burning severity calculation
      const burnSeverity = (darknessLevel * 0.4 + carbonRatio * 0.3 + edgeVariance * 0.3);
      const normalizedSeverity = Math.min(burnSeverity * 10, 1); // Normalize to [0,1]
      
      // Health risk assessment
      let severityLevel = '';
      let healthRiskScore = 0;
      let recommendation = '';
      
      if (normalizedSeverity < 0.2) {
        severityLevel = 'fresh';
        healthRiskScore = 5;
        recommendation = 'Food is properly cooked and safe to eat';
      } else if (normalizedSeverity < 0.4) {
        severityLevel = 'slightly_overcooked';
        healthRiskScore = 20;
        recommendation = 'Minor overcooking detected, still generally safe';
      } else if (normalizedSeverity < 0.7) {
        severityLevel = 'burnt';
        healthRiskScore = 60;
        recommendation = 'Burnt areas detected, avoid burnt portions';
      } else {
        severityLevel = 'severely_burnt';
        healthRiskScore = 90;
        recommendation = 'Severely burnt food, do not consume';
      }
      
      return {
        severityLevel,
        healthRiskScore,
        recommendation,
        burnScore: normalizedSeverity * 100
      };
    });
  }

  /**
   * Generate detailed burnt food analysis report
   */
  generateBurntFoodAnalysis(basePrediction, severityIndicators) {
    const classIndex = basePrediction.class;
    const className = this.modelConfig.classes[classIndex];
    
    const analysis = {
      primaryClass: className,
      confidence: basePrediction.confidence,
      burnLevel: severityIndicators.severityLevel,
      
      specificFindings: [],
      healthRisks: [],
      cookingRecommendations: []
    };

    // Generate specific findings based on class and severity
    switch (className) {
      case 'fresh_food':
        analysis.specificFindings.push('Food has optimal color and texture');
        analysis.specificFindings.push('No signs of burning or overcooking');
        analysis.healthRisks.push('Minimal - food is properly cooked');
        analysis.cookingRecommendations.push('Cooking level is appropriate');
        break;
        
      case 'slightly_overcooked':
        analysis.specificFindings.push('Minor browning detected');
        analysis.specificFindings.push('Slight texture changes from optimal cooking');
        analysis.healthRisks.push('Low risk - increased antioxidants in browning');
        analysis.cookingRecommendations.push('Reduce cooking time/temperature slightly');
        break;
        
      case 'burnt_food':
        analysis.specificFindings.push('Visible charring and burnt areas');
        analysis.specificFindings.push('Dark spots indicating potential acrylamide formation');
        analysis.healthRisks.push('Medium risk - avoid burnt portions');
        analysis.healthRisks.push('Potential formation of harmful compounds');
        analysis.cookingRecommendations.push('Remove burnt areas before consumption');
        analysis.cookingRecommendations.push('Lower cooking temperature');
        break;
        
      case 'severely_burnt':
        analysis.specificFindings.push('Extensive burning throughout food');
        analysis.specificFindings.push('High levels of carcinogenic compounds likely');
        analysis.healthRisks.push('High risk - do not consume');
        analysis.healthRisks.push('Potential carcinogenic compound formation');
        analysis.cookingRecommendations.push('Discard food entirely');
        analysis.cookingRecommendations.push('Adjust cooking method completely');
        break;
    }

    return analysis;
  }

  /**
   * Custom model architecture for burnt food detection
   */
  buildModel() {
    const model = tf.sequential({
      layers: [
        // Input and initial convolution
        tf.layers.conv2d({
          inputShape: this.inputShape,
          filters: 32,
          kernelSize: 5,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.002 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        // Color analysis layers
        tf.layers.conv2d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.002 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        // Texture analysis layers
        tf.layers.conv2d({
          filters: 128,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.002 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        // Charring detection layers
        tf.layers.conv2d({
          filters: 256,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.002 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.globalAveragePooling2d(),
        
        // Classification with severity awareness
        tf.layers.dense({
          units: 256,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.dropout({ rate: 0.4 }),
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

module.exports = BurntFoodModel;