const tf = require('@tensorflow/tfjs-node');
const FoodSafetyBaseModel = require('./FoodSafetyBaseModel');
const fs = require('fs-extra');
const path = require('path');

/**
 * Nutritional Analysis Model for Indian Foods
 * Estimates nutritional content based on visual analysis of food items
 */
class NutritionalModel extends FoodSafetyBaseModel {
  constructor() {
    super({
      modelType: 'nutritional',
      inputShape: [224, 224, 3],
      numClasses: 1, // Single output for regression (nutritional values)
      regressionOutput: [
        'calories_per_100g', 'protein_g', 'carbs_g', 'fat_g', 
        'fiber_g', 'sugar_g', 'sodium_mg', 'vitamin_c_mg', 'iron_mg', 'calcium_mg'
      ]
    });
  }

  /**
   * Extract nutritional indicators from image
   */
  extractNutritionalFeatures(imageTensor) {
    return tf.tidy(() => {
      // Color analysis for food composition
      const colorFeatures = this.analyzeFoodComposition(imageTensor);
      
      // Texture analysis for preparation methods
      const textureFeatures = this.analyzePreparationTexture(imageTensor);
      
      // Volume and density estimation
      const volumeFeatures = this.estimateFoodVolume(imageTensor);
      
      return tf.concat([colorFeatures, textureFeatures, volumeFeatures], 0);
    });
  }

  /**
   * Analyze food composition through color patterns
   */
  analyzeFoodComposition(imageTensor) {
    return tf.tidy(() => {
      // Convert to HSV for better food type identification
      const hsv = tf.image.rgbToHsv(imageTensor);
      
      // Detect different food components by color ranges
      // Proteins (meat, dairy) - reds and whites
      const proteinMask = this.detectProteinColors(hsv);
      const proteinRatio = proteinMask.mean();
      
      // Carbohydrates (rice, bread) - whites and light colors
      const carbMask = this.detectCarbColors(hsv);
      const carbRatio = carbMask.mean();
      
      // Fats (oils, ghee) - yellows and oranges
      const fatMask = this.detectFatColors(hsv);
      const fatRatio = fatMask.mean();
      
      // Vegetables - greens
      const vegMask = this.detectVegetableColors(hsv);
      const vegRatio = vegMask.mean();
      
      // Overall color saturation (indicates preparation style)
      const saturation = hsv.slice([0, 0, 1], [224, 224, 1]);
      const avgSaturation = saturation.mean();
      
      // Color brightness (indicates cooking level)
      const brightness = hsv.slice([0, 0, 2], [224, 224, 1]);
      const avgBrightness = brightness.mean();
      
      // Clean up
      hsv.dispose();
      saturation.dispose();
      brightness.dispose();
      
      return tf.tensor([proteinRatio.dataSync()[0], carbRatio.dataSync()[0],
                       fatRatio.dataSync()[0], vegRatio.dataSync()[0],
                       avgSaturation.dataSync()[0], avgBrightness.dataSync()[0]]);
    });
  }

  /**
   * Detect protein-rich food colors
   */
  detectProteinColors(hsvImage) {
    return tf.tidy(() => {
      const hue = hsvImage.slice([0, 0, 0], [224, 224, 1]);
      const saturation = hsvImage.slice([0, 0, 1], [224, 224, 1]);
      
      // Meat proteins (reds)
      const meatMask = hue.greater(0).logicalAnd(hue.less(0.1))
        .logicalAnd(saturation.greater(0.3));
      
      // Dairy proteins (whites/light)
      const dairyMask = saturation.less(0.2).logicalAnd(hue.greater(0).logicalAnd(hue.less(0.2)));
      
      return meatMask.logicalOr(dairyMask);
    });
  }

  /**
   * Detect carbohydrate-rich food colors
   */
  detectCarbColors(hsvImage) {
    return tf.tidy(() => {
      const saturation = hsvImage.slice([0, 0, 1], [224, 224, 1]);
      const brightness = hsvImage.slice([0, 0, 2], [224, 224, 1]);
      
      // Light colors (rice, bread, potatoes)
      return saturation.less(0.3).logicalAnd(brightness.greater(0.5));
    });
  }

  /**
   * Detect fat-rich food colors
   */
  detectFatColors(hsvImage) {
    return tf.tidy(() => {
      const hue = hsvImage.slice([0, 0, 0], [224, 224, 1]);
      const saturation = hsvImage.slice([0, 0, 1], [224, 224, 1]);
      
      // Yellows and oranges (ghee, oils, fried foods)
      return hue.greater(0.1).logicalAnd(hue.less(0.2)).logicalAnd(saturation.greater(0.3));
    });
  }

  /**
   * Detect vegetable colors
   */
  detectVegetableColors(hsvImage) {
    return tf.tidy(() => {
      const hue = hsvImage.slice([0, 0, 0], [224, 224, 1]);
      const saturation = hsvImage.slice([0, 0, 1], [224, 224, 1]);
      
      // Greens (leafy vegetables, herbs)
      return hue.greater(0.25).logicalAnd(hue.less(0.45)).logicalAnd(saturation.greater(0.2));
    });
  }

  /**
   * Analyze preparation texture
   */
  analyzePreparationTexture(imageTensor) {
    return tf.tidy(() => {
      const grayImage = tf.image.rgbToGrayscale(imageTensor);
      
      // Edge density indicates texture roughness
      const sobelX = tf.image.sobelEdges(grayImage).slice([0, 0, 0], [224, 224, 1, 1]);
      const sobelY = tf.image.sobelEdges(grayImage).slice([0, 0, 1], [224, 224, 1, 1]);
      
      const edgeMagnitude = tf.sqrt(sobelX.square().add(sobelY.square()));
      const textureDensity = edgeMagnitude.greater(0.1).mean();
      
      // Smoothness indicator (for creamy/gravy foods)
      const smoothed = this.applyBoxBlur(grayImage);
      const smoothness = grayImage.sub(smoothed).square().mean();
      
      // Local variance for food uniformity
      const localVar = this.calculateLocalVariance(grayImage);
      
      // Clean up
      grayImage.dispose();
      sobelX.dispose();
      sobelY.dispose();
      edgeMagnitude.dispose();
      smoothed.dispose();
      localVar.dispose();
      
      return tf.tensor([textureDensity.dataSync()[0], smoothness.dataSync()[0],
                       localVar.dataSync()[0]]);
    });
  }

  /**
   * Apply box blur for smoothness calculation
   */
  applyBoxBlur(imageTensor) {
    return tf.tidy(() => {
      const kernel = tf.ones([3, 3, 1, 1]).div(9);
      const blurred = tf.conv2d(imageTensor.reshape([224, 224, 1]), kernel, 1, 'same');
      kernel.dispose();
      return blurred;
    });
  }

  /**
   * Calculate local variance for food uniformity
   */
  calculateLocalVariance(imageTensor) {
    return tf.tidy(() => {
      const kernel = tf.tidy(() => {
        const values = [1, 2, 1, 2, 4, 2, 1, 2, 1];
        const kernel1d = tf.tensor1d(values).div(16);
        const kernel2d = tf.outerProduct(kernel1d, kernel1d);
        return kernel2d.reshape([3, 3, 1, 1]);
      });
      
      const mean = tf.conv2d(imageTensor.reshape([224, 224, 1]), kernel, 1, 'same');
      const squared = imageTensor.reshape([224, 224, 1]).square();
      const meanSquared = tf.conv2d(squared, kernel, 1, 'same');
      
      const variance = meanSquared.sub(mean.square());
      const varianceMean = variance.mean();
      
      kernel.dispose();
      mean.dispose();
      squared.dispose();
      meanSquared.dispose();
      variance.dispose();
      
      return varianceMean;
    });
  }

  /**
   * Estimate food volume and portion size
   */
  estimateFoodVolume(imageTensor) {
    return tf.tidy(() => {
      // Convert to grayscale for better volume estimation
      const grayImage = tf.image.rgbToGrayscale(imageTensor);
      
      // Food area estimation
      const foodMask = grayImage.greater(0.1); // Basic food detection
      const foodArea = foodMask.sum();
      
      // Density estimation (texture uniformity)
      const densityEstimate = this.estimateDensity(grayImage);
      
      // Portion size estimation
      const totalPixels = 224 * 224;
      const areaRatio = foodArea.div(totalPixels);
      
      // Clean up
      grayImage.dispose();
      foodMask.dispose();
      foodArea.dispose();
      densityEstimate.dispose();
      
      return tf.tensor([areaRatio.dataSync()[0], densityEstimate.dataSync()[0]]);
    });
  }

  /**
   * Estimate food density from texture
   */
  estimateDensity(grayImage) {
    return tf.tidy(() => {
      // Dense foods have less variance in texture
      const variance = grayImage.sub(grayImage.mean()).square().mean();
      // Inverse relationship: lower variance = higher density
      return tf.tensor([1 / (variance.add(1e-7))]);
    });
  }

  /**
   * Enhanced nutritional prediction
   */
  async predict(imagePath) {
    try {
      const basePrediction = await super.predict(imagePath);
      
      // Extract nutritional specific features
      const preprocessedImage = await this.preprocessImage(imagePath);
      const nutritionalFeatures = this.extractNutritionalFeatures(preprocessedImage);
      
      // Calculate detailed nutritional estimates
      const nutritionalEstimates = this.calculateNutritionalEstimates(nutritionalFeatures);
      
      // Generate comprehensive nutrition analysis
      const detailedAnalysis = this.generateNutritionAnalysis(nutritionalEstimates);
      
      // Cleanup
      preprocessedImage.dispose();
      nutritionalFeatures.dispose();
      
      return {
        ...basePrediction,
        ...detailedAnalysis,
        nutritionalProfile: nutritionalEstimates,
        healthScore: nutritionalEstimates.healthScore
      };
    } catch (error) {
      throw new Error(`Nutritional prediction failed: ${error.message}`);
    }
  }

  /**
   * Calculate nutritional estimates from visual features
   */
  calculateNutritionalEstimates(nutritionalFeatures) {
    return tf.tidy(() => {
      const features = nutritionalFeatures.dataSync();
      
      const proteinRatio = features[0];
      const carbRatio = features[1];
      const fatRatio = features[2];
      const vegRatio = features[3];
      const saturation = features[4];
      const brightness = features[5];
      const textureDensity = features[6];
      const smoothness = features[7];
      const areaRatio = features[9];
      
      // Base nutritional calculations per 100g (Indian food context)
      let calories = 0;
      let protein = 0;
      let carbs = 0;
      let fat = 0;
      let fiber = 0;
      let sugar = 0;
      let sodium = 0;
      let vitaminC = 0;
      let iron = 0;
      let calcium = 0;
      
      // Calorie estimation based on food composition
      calories = (proteinRatio * 4 + carbRatio * 4 + fatRatio * 9) * 100; // Approximate calories per 100g
      
      // Protein content estimation
      protein = proteinRatio * 25; // Average protein content for protein-rich foods
      
      // Carbohydrate content
      carbs = carbRatio * 50; // Average carb content
      
      // Fat content
      fat = fatRatio * 15; // Average fat content
      
      // Fiber from vegetables
      fiber = vegRatio * 8; // Fiber from vegetable content
      
      // Sugar estimation (simplified)
      sugar = Math.min(carbRatio * 5, 15); // Max 15g per 100g
      
      // Sodium (higher in processed/spiced foods)
      sodium = (saturation * 200 + 50); // Base sodium + spicing level
      
      // Micronutrients
      vitaminC = vegRatio * 10; // From vegetables
      iron = (vegRatio + proteinRatio) * 2; // From vegetables and protein
      calcium = (proteinRatio + fatRatio) * 100; // From dairy and leafy greens
      
      // Health score calculation
      const proteinPerCal = protein / (calories + 1e-7);
      const fiberPerCal = fiber / (calories + 1e-7);
      const fatPerCal = fat / (calories + 1e-7);
      
      let healthScore = 50; // Base score
      
      // Adjust based on nutritional balance
      if (proteinPerCal > 0.15) healthScore += 20; // Good protein
      if (fiberPerCal > 0.02) healthScore += 15; // Good fiber
      if (fatPerCal < 0.3) healthScore += 10; // Moderate fat
      if (vegRatio > 0.3) healthScore += 15; // Good vegetable content
      
      healthScore = Math.min(Math.max(healthScore, 0), 100);
      
      return {
        calories: Math.round(calories),
        protein: Math.round(protein * 10) / 10,
        carbs: Math.round(carbs * 10) / 10,
        fat: Math.round(fat * 10) / 10,
        fiber: Math.round(fiber * 10) / 10,
        sugar: Math.round(sugar * 10) / 10,
        sodium: Math.round(sodium),
        vitaminC: Math.round(vitaminC * 10) / 10,
        iron: Math.round(iron * 10) / 10,
        calcium: Math.round(calcium),
        healthScore: Math.round(healthScore),
        portionSize: areaRatio > 0.3 ? 'large' : areaRatio > 0.15 ? 'medium' : 'small'
      };
    });
  }

  /**
   * Generate detailed nutritional analysis report
   */
  generateNutritionAnalysis(nutritionalEstimates) {
    const analysis = {
      nutritionalProfile: nutritionalEstimates,
      
      macroAnalysis: {},
      microAnalysis: {},
      healthInsights: [],
      recommendations: []
    };

    // Macronutrient analysis
    analysis.macroAnalysis = {
      proteinPercentage: Math.round((nutritionalEstimates.protein * 4 / nutritionalEstimates.calories) * 100),
      carbPercentage: Math.round((nutritionalEstimates.carbs * 4 / nutritionalEstimates.calories) * 100),
      fatPercentage: Math.round((nutritionalEstimates.fat * 9 / nutritionalEstimates.calories) * 100),
      calories: nutritionalEstimates.calories
    };

    // Micronutrient analysis
    analysis.microAnalysis = {
      fiber: nutritionalEstimates.fiber,
      sugar: nutritionalEstimates.sugar,
      sodium: nutritionalEstimates.sodium,
      vitaminC: nutritionalEstimates.vitaminC,
      iron: nutritionalEstimates.iron,
      calcium: nutritionalEstimates.calcium
    };

    // Health insights
    if (nutritionalEstimates.healthScore >= 80) {
      analysis.healthInsights.push('Excellent nutritional profile');
      analysis.recommendations.push('Great choice for balanced nutrition');
    } else if (nutritionalEstimates.healthScore >= 60) {
      analysis.healthInsights.push('Good nutritional balance');
      analysis.recommendations.push('Consider adding more vegetables for extra nutrients');
    } else if (nutritionalEstimates.healthScore >= 40) {
      analysis.healthInsights.push('Moderate nutritional value');
      analysis.recommendations.push('Add fiber-rich sides or reduce portion size');
    } else {
      analysis.healthInsights.push('Nutritionally poor choice');
      analysis.recommendations.push('Consider healthier alternatives or add vegetables');
    }

    // Specific nutritional recommendations
    if (nutritionalEstimates.protein < 10) {
      analysis.recommendations.push('Low in protein - consider adding lentils or yogurt');
    }
    if (nutritionalEstimates.fiber < 3) {
      analysis.recommendations.push('Low fiber content - add vegetables or whole grains');
    }
    if (nutritionalEstimates.fat > 20) {
      analysis.recommendations.push('High fat content - consider preparing with less oil');
    }
    if (nutritionalEstimates.sodium > 600) {
      analysis.recommendations.push('High sodium - rinse or prepare with less salt');
    }

    return analysis;
  }

  /**
   * Custom regression model for nutritional analysis
   */
  buildModel() {
    const model = tf.sequential({
      layers: [
        // Input layer optimized for food analysis
        tf.layers.conv2d({
          inputShape: this.inputShape,
          filters: 32,
          kernelSize: 5,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        // Food composition analysis
        tf.layers.conv2d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        // Texture and preparation analysis
        tf.layers.conv2d({
          filters: 128,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.maxPooling2d({ poolSize: 2 }),
        
        // Portion size and density analysis
        tf.layers.conv2d({
          filters: 256,
          kernelSize: 3,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.batchNormalization(),
        tf.layers.globalAveragePooling2d(),
        
        // Regression layers for nutritional values
        tf.layers.dense({
          units: 512,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.dropout({ rate: 0.4 }),
        tf.layers.dense({
          units: 256,
          activation: 'relu',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.001 })
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: this.modelConfig.regressionOutput.length,
          activation: 'linear' // Linear activation for regression
        })
      ]
    });

    return model;
  }

  /**
   * Compile model for regression
   */
  compileModel() {
    const optimizer = tf.train.adam(0.0005); // Lower learning rate for regression
    
    this.model.compile({
      optimizer: optimizer,
      loss: 'meanSquaredError',
      metrics: ['mae', 'mse']
    });

    console.log(`✅ ${this.modelType} model compiled for regression`);
  }
}

module.exports = NutritionalModel;