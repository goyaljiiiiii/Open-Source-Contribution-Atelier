import React from 'react';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  Image,
  Font 
} from '@react-pdf/renderer';

// Register font
Font.register({
  family: 'Inter',
  src: 'https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2'
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#ffffff',
    fontFamily: 'Inter'
  },
  header: {
    borderBottom: '2px solid #6c63ff',
    paddingBottom: 16,
    marginBottom: 24
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a2e'
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4
  },
  section: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 8,
    borderBottom: '1px solid #eee',
    paddingBottom: 4
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottom: '1px solid #f5f5f5'
  },
  label: {
    fontSize: 12,
    color: '#666'
  },
  value: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1a1a2e'
  },
  badge: {
    backgroundColor: '#6c63ff',
    color: 'white',
    padding: '4px 12px',
    borderRadius: 4,
    fontSize: 10,
    marginRight: 4
  },
  footer: {
    marginTop: 32,
    paddingTop: 16,
    borderTop: '1px solid #eee',
    textAlign: 'center',
    fontSize: 10,
    color: '#999'
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8
  },
  statBox: {
    backgroundColor: '#f5f3ff',
    padding: '8px 16px',
    borderRadius: 6,
    minWidth: 100
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6c63ff'
  },
  statLabel: {
    fontSize: 10,
    color: '#666'
  }
});

export function ProgressReportPDF({ userData, progress }) {
  const { 
    username, 
    joinDate, 
    totalXp, 
    streak, 
    completedLessons = [], 
    badges = [],
    stats 
  } = progress;
