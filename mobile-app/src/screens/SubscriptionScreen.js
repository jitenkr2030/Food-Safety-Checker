// SubscriptionScreen.js - React Native Implementation Demo
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SubscriptionService from '../services/SubscriptionService';

const SubscriptionScreen = () => {
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [usage, setUsage] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      const [subscriptionData, usageData] = await Promise.all([
        SubscriptionService.getCurrentSubscription(),
        SubscriptionService.getUsage()
      ]);
      
      setCurrentSubscription(subscriptionData);
      setUsage(usageData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (tierId) => {
    try {
      setLoading(true);
      const result = await SubscriptionService.subscribe(tierId);
      
      Alert.alert(
        'Subscription Activated!', 
        `You are now on the ${tierId} plan. Welcome to FoodSafe Pro!`,
        [{ text: 'OK', onPress: () => loadSubscriptionData() }]
      );
    } catch (error) {
      Alert.alert('Subscription Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderTier = (tier) => {
    const isCurrentTier = currentSubscription?.tier === tier.id;
    const isUpgrade = getTierPriority(currentSubscription?.tier) < getTierPriority(tier.id);
    
    return (
      <View key={tier.id} style={[styles.tierCard, tier.popular && styles.popularTier]}>
        {tier.popular && <View style={styles.popularBadge}><Text style={styles.popularText}>POPULAR</Text></View>}
        {tier.business && <View style={styles.businessBadge}><Text style={styles.businessText}>BUSINESS</Text></View>}
        
        <Text style={styles.tierName}>{tier.name}</Text>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>{tier.price}</Text>
          <Text style={styles.period}>/{tier.period}</Text>
          {tier.originalPrice && (
            <Text style={styles.originalPrice}>{tier.originalPrice}</Text>
          )}
        </View>
        
        <View style={styles.featuresContainer}>
          {tier.features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Text style={styles.featureIcon}>✓</Text>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.subscribeButton,
            isCurrentTier && styles.currentTierButton,
            isUpgrade && styles.upgradeButton
          ]}
          onPress={() => handleSubscribe(tier.id)}
          disabled={isCurrentTier || loading}
        >
          <Text style={[
            styles.subscribeButtonText,
            isCurrentTier && styles.currentTierText,
            isUpgrade && styles.upgradeText
          ]}>
            {isCurrentTier ? 'Current Plan' : isUpgrade ? 'Upgrade' : 'Subscribe'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const getTierPriority = (tier) => {
    const priorities = { 'free': 0, 'premium': 1, 'family': 2, 'restaurant': 3, 'business': 4, 'enterprise': 5 };
    return priorities[tier] || 0;
  };

  const renderUsageCard = () => {
    if (!usage.canUse) {
      return (
        <View style={styles.usageCard}>
          <Text style={styles.usageTitle}>Daily Limit Reached</Text>
          <Text style={styles.usageSubtitle}>Upgrade to continue analyzing food safety</Text>
          <TouchableOpacity style={styles.upgradeNowButton}>
            <Text style={styles.upgradeNowText}>Upgrade Now</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.usageCard}>
        <Text style={styles.usageTitle}>Today's Usage</Text>
        <View style={styles.usageProgress}>
          <View 
            style={[
              styles.usageProgressBar, 
              { width: `${(usage.todayUsage / usage.dailyLimit) * 100}%` }
            ]} 
          />
        </View>
        <Text style={styles.usageText}>
          {usage.todayUsage} of {usage.dailyLimit === 'unlimited' ? '∞' : usage.dailyLimit} analyses used
        </Text>
      </View>
    );
  };

  const tiers = Object.values(SubscriptionService.tiers);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose Your Plan</Text>
          <Text style={styles.subtitle}>
            {currentSubscription 
              ? `Current: ${currentSubscription.tier} plan`
              : 'Start with our free plan or upgrade anytime'
            }
          </Text>
        </View>

        {renderUsageCard()}

        <View style={styles.tiersContainer}>
          {tiers.map(renderTier)}
        </View>

        <View style={styles.faqContainer}>
          <Text style={styles.faqTitle}>Frequently Asked Questions</Text>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Can I change plans anytime?</Text>
            <Text style={styles.faqAnswer}>Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.</Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>What payment methods do you accept?</Text>
            <Text style={styles.faqAnswer}>We accept credit/debit cards, UPI, net banking, and digital wallets through Razorpay.</Text>
          </View>
          
          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Is there a free trial?</Text>
            <Text style={styles.faqAnswer}>Our free plan gives you 5 analyses daily. Premium features are available with paid plans.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  usageCard: {
    margin: 20,
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  usageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
  },
  usageProgress: {
    height: 8,
    backgroundColor: '#ecf0f1',
    borderRadius: 4,
    marginBottom: 12,
  },
  usageProgressBar: {
    height: 8,
    backgroundColor: '#e74c3c',
    borderRadius: 4,
  },
  usageText: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  upgradeNowButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  upgradeNowText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  tiersContainer: {
    paddingHorizontal: 20,
  },
  tierCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    position: 'relative',
  },
  popularTier: {
    borderWidth: 2,
    borderColor: '#e74c3c',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    left: 20,
    backgroundColor: '#e74c3c',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  businessBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  businessText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tierName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 16,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e74c3c',
  },
  period: {
    fontSize: 16,
    color: '#7f8c8d',
    marginLeft: 4,
  },
  originalPrice: {
    fontSize: 16,
    color: '#95a5a6',
    textDecorationLine: 'line-through',
    marginLeft: 8,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureIcon: {
    color: '#27ae60',
    fontSize: 16,
    marginRight: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#2c3e50',
    flex: 1,
  },
  subscribeButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  currentTierButton: {
    backgroundColor: '#95a5a6',
  },
  upgradeButton: {
    backgroundColor: '#27ae60',
  },
  subscribeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  currentTierText: {
    color: '#ffffff',
  },
  upgradeText: {
    color: '#ffffff',
  },
  faqContainer: {
    margin: 20,
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  faqTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  faqItem: {
    marginBottom: 16,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
  },
});

export default SubscriptionScreen;