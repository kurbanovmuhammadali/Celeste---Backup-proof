import React from 'react';
import { View } from 'react-native';

/** Renders children; if WebGL is unavailable or a scene throws, shows `fallback` instead of crashing the screen. */
export class Safe3D extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode; style?: any }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn('3D scene disabled:', e); }
  render() {
    return <View style={this.props.style}>{this.state.failed ? this.props.fallback ?? null : this.props.children}</View>;
  }
}
