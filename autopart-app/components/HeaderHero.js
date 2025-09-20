import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

const HeaderHero = ({ navigation, fullPage = false }) => {
  const { width, height } = useWindowDimensions();

  const isNarrow = width < 860;
  const isMedium = width >= 860 && width < 1200;

  // responsive hero height
  let heroHeight;
  if (fullPage) {
    // make hero fill viewport height but account for a top nav offset so it appears full-screen under the header
    const navOffset = 96; // matches App.js paddingTop for the nav
    heroHeight = Math.max(320, Math.round(height - navOffset));
  } else {
    if (isNarrow) heroHeight = Math.max(420, Math.round(width * 0.55));
    else if (isMedium) heroHeight = Math.max(360, Math.round(width * 0.45));
    else heroHeight = Math.max(320, Math.round(width * 0.32));
    heroHeight = Math.min(heroHeight, Math.round(height * 0.78));
  }

  const heroTitleSize = isNarrow ? 40 : isMedium ? 64 : 80;

  return (
    <View style={[styles.heroWrap, { height: heroHeight }]} className="hero">
      <Video
        source={require('../assets/Engine_Machinery_bg.mp4')}
        shouldPlay
        isLooping
        isMuted
        resizeMode="cover"
        style={styles.heroVideo}
      />

      <LinearGradient colors={[ 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.45)' ]} style={StyleSheet.absoluteFill} />

      <View style={[styles.heroContent, { paddingHorizontal: Math.min(48, Math.round(width * 0.06)) }]} className="hero-content">
        <Text style={styles.kicker}>Shop Our Premium Auto Parts</Text>
        <Text style={[styles.heroTitle, { fontSize: heroTitleSize }]} className="heroTitle">Build Your Dream Car Today.{"\n"}Now 15% Off On All Items.</Text>

        <View style={styles.heroCtas} className="hero-ctas">
          <TouchableOpacity style={styles.ctaPrimary} onPress={() => navigation.navigate('Products')} testID="cta-shop-now">
            <Text style={styles.ctaPrimaryText}>Shop Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaOutlined} onPress={() => navigation.navigate('Products')} testID="cta-view-categories">
            <Text style={styles.ctaOutlinedText}>View Categories</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  heroWrap: { minHeight: 280, overflow: 'hidden', justifyContent: 'center', backgroundColor: '#000' },
  heroVideo: { ...StyleSheet.absoluteFillObject },
  heroContent: { paddingHorizontal: 28, maxWidth: 900, zIndex: 10 },
  kicker: { color: '#fef2f2', fontWeight: '400', marginBottom: 8, letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 34, fontWeight: '400', marginBottom: 8 },
  heroCtas: { flexDirection: 'row', marginTop: 8 },
  ctaPrimary: { backgroundColor: '#ff4d36', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 28, marginRight: 12 },
  ctaPrimaryText: { color: '#fff', fontWeight: '800' },
  ctaOutlined: { borderWidth: 1, borderColor: '#fecaca', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8 },
  ctaOutlinedText: { color: '#fecaca', fontWeight: '700' },
});

export default HeaderHero;
