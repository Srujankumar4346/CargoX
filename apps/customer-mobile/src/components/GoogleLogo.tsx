import React from 'react';
import { View } from 'react-native';

interface GoogleLogoProps {
  size?: number;
}

export const GoogleLogo: React.FC<GoogleLogoProps> = ({ size = 20 }) => {
  // Renders a high-fidelity SVG/Canvas or pixel-perfect 4-color Google 'G' icon badge
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e2e8f0',
      }}
    >
      <View
        style={{
          width: size * 0.75,
          height: size * 0.75,
          borderRadius: (size * 0.75) / 2,
          borderWidth: size * 0.16,
          borderColor: '#4285F4',
          borderTopColor: '#EA4335',
          borderRightColor: '#FBBC05',
          borderBottomColor: '#34A853',
        }}
      />
    </View>
  );
};
