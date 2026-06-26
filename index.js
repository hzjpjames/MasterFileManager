import {AppRegistry} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {Provider as PaperProvider} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MainNavigator from './src/navigation/MainNavigator';

const App = () => (
  <PaperProvider icon={props => <MaterialCommunityIcons {...props} />}>
    <NavigationContainer>
      <MainNavigator />
    </NavigationContainer>
  </PaperProvider>
);

AppRegistry.registerComponent('MasterFileManager', () => App);
