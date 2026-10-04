import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

/**
 * Design-System UniWeaver — identische Tokens zu CourseWeaver/TimeWeaver
 * (BFH-Blau + Gelb), damit die Apps als eine Produktfamilie wirken.
 */
export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        dark: false,
        colors: {
          primary: '#0B5DBA',       // BFH-Blau
          secondary: '#15489B',
          accent: '#F2A900',
          error: '#C62828',
          success: '#2E7D32',
          warning: '#EF6C00',
          info: '#0277BD',
          surface: '#F5F7FA',
          'surface-bright': '#FFFFFF',
          'surface-variant': '#E8EEF7',
          // Vuetify's stock light theme pairs surface-variant (#424242) with a
          // light on-surface-variant (#EEEEEE). We lighten surface-variant, so
          // the companion text color must go dark as well — otherwise tooltips,
          // chips and slider labels render light-on-light (invisible).
          'on-surface': '#102230',
          'on-surface-variant': '#102230',
        },
        variables: {
          'border-radius-root': '12px',
        },
      },
      dark: {
        dark: true,
        colors: {
          primary: '#3D6DB5',
          secondary: '#102A4C',
          accent: '#F2A900',
          error: '#E57373',
          success: '#66BB6A',
          warning: '#FFA726',
          info: '#4FC3F7',
          surface: '#0E1B2C',
          'surface-bright': '#16273D',
          'surface-variant': '#1B3049',
          'on-surface': '#E8EEF7',
          'on-surface-variant': '#E8EEF7',
        },
        variables: {
          'border-radius-root': '12px',
        },
      },
    },
  },
  defaults: {
    VCard: { rounded: 'lg', elevation: 1 },
    VBtn: { rounded: 'lg' },
    VTextField: { variant: 'outlined', density: 'compact' },
    VSelect: { variant: 'outlined', density: 'compact' },
    VTextarea: { variant: 'outlined', density: 'compact' },
    VAutocomplete: { variant: 'outlined', density: 'compact' },
    VCombobox: { variant: 'outlined', density: 'compact' },
    VDataTable: { density: 'compact' },
  },
})