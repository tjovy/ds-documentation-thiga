import type { Preview } from '@storybook/react-vite';

import '../src/stories/zeroheight.css';
import '../src/stories/zeroheight-overrides.css';
import '../src/stories/variables.css';
import './theme.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
    backgrounds: {
      options: {
        zeroheight: { name: 'zeroheight', value: '#f9fafb' },
        white: { name: 'white', value: '#ffffff' }
      }
    },
  },

  initialGlobals: {
    backgrounds: {
      value: 'zeroheight'
    }
  }
};

export default preview;
