import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import WebView from 'react-native-webview';
import { useThemeColors } from '@/hooks/useThemeColors';

interface WebViewLatexBlockProps {
  latex: string;
}

const WebViewLatexBlock: React.FC<WebViewLatexBlockProps> = ({ latex }) => {
  const [webViewHeight, setWebViewHeight] = useState(50); 
  const webViewRef = useRef<WebView>(null);
  const [webViewKey, setWebViewKey] = useState(Date.now().toString());
  const colors = useThemeColors();

  // If the content was heuristic-flagged as LaTeX but lacks standard delimiters, auto-wrap it.
  const hasDelimiters = /(\$\$|\$|\\\(|\\\[)/.test(latex);
  const contentForMathJaxDisplay = hasDelimiters ? latex : `\\(${latex}\\)`;
  const scriptLatexStringLiteral = JSON.stringify(latex);

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <style>
      body {
        margin: 0;
        padding: 8px 16px; 
        background-color: transparent; 
        color: ${colors.textDark}; 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 22px;
        line-height: 1.45;
        visibility: hidden; 
        overflow-x: hidden;
        overflow-y: hidden; 
      }
      #math-content {
          overflow-wrap: break-word; 
          word-wrap: break-word;
          width: 100%; 
          text-align: center;
          white-space: pre-wrap; 
      }
      mjx-container svg {
          max-width: 100%;
          height: auto !important;
      }
    </style>
  </head>
  <body>
    <div id="math-content">${contentForMathJaxDisplay}</div>
    <script type="text/javascript">
      const originalLatexPropValue = ${scriptLatexStringLiteral};

      function sendMessage(type, data) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, latex: originalLatexPropValue, data }));
      }

      function updateHeight() {
        setTimeout(function() {
          var contentBlock = document.getElementById('math-content');
          if (!contentBlock) return;
          
          var rect = contentBlock.getBoundingClientRect();
          var exactHeight = Math.ceil(rect.height) + 16; 
          exactHeight = Math.max(exactHeight, 30); 
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'rendered_height',
            height: exactHeight,
            latex: originalLatexPropValue 
          }));
        }, 150); 
      }

      try {
        sendMessage('DEBUG_MSG', 'WebView script loaded. Latex prop for msg: ' + originalLatexPropValue);
      } catch(e) {
         window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', data: 'Initial sendMessage failed: ' + e.toString()}));
      }

      document.addEventListener('DOMContentLoaded', function() {
        sendMessage('dom_content_loaded', 'DOMContentLoaded event fired.');
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
              MathJax.typeset(); 
              document.body.style.visibility = 'visible'; 
              sendMessage('mathjax_status', 'MathJax.typeset() called.');
            } catch(e) {
              document.body.style.visibility = 'visible';
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
    </script>
    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>
  </body>
  </html>
`;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'rendered_height' && data.latex === latex) {
        setWebViewHeight(prev => {
          if (Math.abs(prev - data.height) > 2) {
            return data.height;
          }
          return prev;
        });
      } else if (data.type === 'ERROR') {
        console.error('[WebView Error]', data.data);
      }
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
