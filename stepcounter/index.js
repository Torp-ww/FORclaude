// Точка входа с защитой от падений: если приложение не может запуститься,
// вместо закрытия показывается текст ошибки.
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { registerRootComponent } from 'expo';

let App = null;
let startupError = null;
let lateError = null;
let listener = null;

try {
  global.ErrorUtils.setGlobalHandler((e) => { lateError = e; if (listener) listener(e); });
} catch (e) {}

try {
  App = require('./App').default;
} catch (e) {
  startupError = e;
}

function ErrorScreen({ error }) {
  const text = String((error && (error.stack || error.message)) || error);
  return (
    <View style={{ flex: 1, backgroundColor: '#0B1217', paddingTop: 60, padding: 16 }}>
      <Text style={{ color: '#FB7185', fontSize: 20, fontWeight: '700', marginBottom: 8 }}>Ошибка запуска</Text>
      <Text style={{ color: '#F2F6F8', marginBottom: 12 }}>Сделайте скриншот этого экрана и отправьте разработчику.</Text>
      <ScrollView><Text selectable style={{ color: '#8896A0', fontSize: 12 }}>{text.slice(0, 3000)}</Text></ScrollView>
    </View>
  );
}

class Boundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() { return this.state.error ? <ErrorScreen error={this.state.error} /> : this.props.children; }
}

function Root() {
  const [err, setErr] = React.useState(startupError || lateError);
  React.useEffect(() => { listener = setErr; if (lateError) setErr(lateError); return () => { listener = null; }; }, []);
  if (err || !App) return <ErrorScreen error={err} />;
  return <Boundary><App /></Boundary>;
}

registerRootComponent(Root);
