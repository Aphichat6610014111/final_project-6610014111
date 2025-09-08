import React from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from 'react-native';
import assetsIndex from '../assets/assetsIndex';

const posts = [
  {
    id: '1',
    title: 'NRK 102 Iridium V Spark Plug',
    subtitle: 'Create a blog post subtitle that summarizes your post in a few short, punchy sentences and entices your audience to continue reading....',
    author: 'Admin',
    date: 'Jun 5, 2023',
    comments: 0,
    likes: 3,
    imageKey: 'images',
  },
  {
    id: '2',
    title: 'Dual-Plane Intake Manifold',
    subtitle: 'Create a blog post subtitle that summarizes your post in a few short, punchy sentences and entices your audience to continue reading....',
    author: 'Admin',
    date: 'Jun 5, 2023',
    comments: 0,
    likes: 4,
    imageKey: 'images',
  },
  {
    id: '3',
    title: 'Brakes PL Series Brake Rotors',
    subtitle: 'Create a blog post subtitle that summarizes your post in a few short, punchy sentences and entices your audience to continue reading....',
    author: 'Admin',
    date: 'Jun 5, 2023',
    comments: 1,
    likes: 4,
    imageKey: 'Brake Disc',
  },
  {
    id: '4',
    title: 'SV11 A/C compressor',
    subtitle: 'Create a blog post subtitle that summarizes your post in a few short, punchy sentences and entices',
    author: 'Admin',
    date: 'Jun 5, 2023',
    comments: 0,
    likes: 0,
    imageKey: 'images',
  },
];

export default function Reviews({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Recommended Products</Text>
      <Text style={styles.subheading}>Let the community help you shop</Text>

      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        renderItem={({ item }) => {
          const img = assetsIndex.map[item.imageKey.toLowerCase()] || assetsIndex.map[item.imageKey.replace(/\s+/g, '_').toLowerCase()] || null;
          return (
            <TouchableOpacity style={styles.card} onPress={() => {}}>
              {img ? <Image source={img} style={styles.cardImage} resizeMode="cover" /> : <View style={[styles.cardImage, { backgroundColor: '#f3f4f6' }]} />}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle} numberOfLines={2}>{item.subtitle}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>{item.author} • {item.date}</Text>
                  <Text style={styles.metaText}>{item.comments} • {item.likes} likes</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  heading: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subheading: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  card: { flexDirection: 'row', marginBottom: 12, borderRadius: 8, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9ecef' },
  cardImage: { width: 120, height: 100 },
  cardBody: { flex: 1, padding: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSubtitle: { color: '#6b7280', marginTop: 6 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  metaText: { color: '#9ca3af', fontSize: 12 }
});
