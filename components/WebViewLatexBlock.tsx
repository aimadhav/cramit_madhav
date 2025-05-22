import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, useColorScheme, Platform } from 'react-native';
import WebView from 'react-native-webview';

interface WebViewLatexBlockProps {
  latex: string;
}

const WebViewLatexBlock: React.FC<WebViewLatexBlockProps> = ({ latex }) => {
  const [webViewHeight, setWebViewHeight] = useState(50); 
  const webViewRef = useRef<WebView>(null);
  const [webViewKey, setWebViewKey] = useState(Date.now().toString());
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? 
                { colors: { backgroundColor: '#121212', textColor: 'white' } } : 
                { colors: { backgroundColor: 'white', textColor: 'black' } };
  const { backgroundColor, textColor } = theme.colors;

  const contentForMathJaxDisplay = latex;
  const scriptLatexStringLiteral = JSON.stringify(latex);

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: ${backgroundColor};
        color: ${textColor};
        display: flex;
        justify-content: flex-start; 
        align-items: flex-start; 
        min-height: 1px;
      }
      #math-content {
          overflow-wrap: break-word; 
          width: 100%; 
      }
    </style>
  </head>
  <body>
    <div id="math-content">$$${contentForMathJaxDisplay}$$</div>
    <script type="text/javascript">
      // This JS variable 'originalLatexPropValue' will hold the true value of the latex prop
      const originalLatexPropValue = ${scriptLatexStringLiteral};

      function sendMessage(type, data) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, latex: originalLatexPropValue, data }));
      }

      function updateHeight() {
        setTimeout(function() {
          var contentElement = document.getElementById('math-content');
          var newHeight = contentElement ? contentElement.scrollHeight : document.body.scrollHeight;
          newHeight = Math.max(newHeight, 20); 
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'rendered_height',
            height: newHeight,
            latex: originalLatexPropValue 
          }));
        }, 350); // Increased timeout slightly, was 350, can be tuned
      }

      // Initial message for debugging if script loads
      try {
        sendMessage('DEBUG_MSG', 'WebView script loaded. Latex prop for msg: ' + originalLatexPropValue);
      } catch(e) {
         window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', data: 'Initial sendMessage failed: ' + e.toString()}));
      }

      document.addEventListener('DOMContentLoaded', function() {
        sendMessage('dom_content_loaded', 'DOMContentLoaded event fired.');
        updateHeight(); // updateHeight will be called after DOMContentLoaded
      });

      window.MathJax = {
        tex: {
          inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
          displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']]
        },
        svg: { 
          fontCache: 'global' 
        },
        startup: {
          ready: function () {
            sendMessage('mathjax_status', 'MathJax startup.ready function called.');
            MathJax.startup.defaultReady();
            sendMessage('mathjax_status', 'MathJax defaultReady executed. Typesetting should be complete.');
            try {
              MathJax.typeset(); // Explicitly call typeset
              sendMessage('mathjax_status', 'MathJax.typeset() called.');
            } catch(e) {
              sendMessage('mathjax_status', 'Error calling MathJax.typeset(): ' + e.toString());
            }
            updateHeight();
          }
        },
        options: {
          skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
          ignoreHtmlClass: 'tex2jax_ignore',
          processHtmlClass: 'tex2jax_process'
        }
      };

      window.addEventListener('resize', updateHeight);
    </script>
    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>
  </body>
  </html>
`;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[WebView Message]', data); 

      // Compare received latex (which is originalLatexPropValue from script) with the component's original latex prop
      if (data.type === 'rendered_height' && data.latex === latex) {
        setWebViewHeight(data.height + 15); // Add some padding
      } else if (data.type === 'ERROR') {
        console.error('[WebView Error]', data.data);
      }
      // Other message types are for logging/debugging
    } catch (error) {
      console.error('Error parsing message from WebView:', error, event.nativeEvent.data);
    }
  };

  useEffect(() => {
    setWebViewKey(Date.now().toString()); // Force re-render if latex prop changes
    setWebViewHeight(50); // Reset height when latex changes
  }, [latex]);

  return (
    <View style={[styles.container, { height: webViewHeight }]}>
      <WebView
        key={webViewKey}
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent, baseUrl: '' }}
        style={styles.webView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onMessage={handleMessage}
        onError={(syntheticEvent) => {
          const {nativeEvent} = syntheticEvent;
          console.warn('WebView error: ', nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          const {nativeEvent} = syntheticEvent;
          console.warn('WebView HTTP error: ', nativeEvent.url, nativeEvent.statusCode, nativeEvent.description);
        }}
        onLoadProgress={({ nativeEvent }) => {
          // console.log('WebView load progress: ', nativeEvent.progress);
        }}
        onShouldStartLoadWithRequest={(request) => {
          // Intercept navigation
          return true;
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    // height is dynamic
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default WebViewLatexBlock;
