module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./node_modules/react-native-vector-icons/Fonts/'],
  dependencies: {
    'react-native-reanimated': {
      platforms: {
        android: null, // exclude from Android build
      },
    },
  },
};
