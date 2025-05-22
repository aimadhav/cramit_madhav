import React, { useState, useEffect, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { useColorScheme, Platform, View, StyleSheet } from 'react-native';

interface WebViewLatexBlockProps {
  latex: string;
  backgroundColor?: string; // Optional: to override theme-based background
  textColor?: string;       // Optional: to override theme-based text color
}

const WebViewLatexBlock: React.FC<WebViewLatexBlockProps> = ({ latex, backgroundColor, textColor }) => {
  const [webViewHeight, setWebViewHeight] = useState(50); // Initial height
  const colorScheme = useColorScheme();
  const webViewRef = useRef<WebView>(null);

  const effectiveTextColor = textColor || (colorScheme === 'dark' ? 'white' : 'black');
  const effectiveBackgroundColor = backgroundColor || (colorScheme === 'dark' ? '#121212' : 'white'); 

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
      <style>
        body {
          margin: 0;
          padding: 5px; 
          background-color: ${effectiveBackgroundColor};
          color: ${effectiveTextColor};
          display: flex; 
          justify-content: flex-start; 
          align-items: flex-start; 
          min-height: 10px; 
        }
        #math-content {
            font-size: 1.1em; 
            overflow-wrap: break-word; 
            width: 100%; 
        }
      </style>
    </head>
    <body>
      <div id="math-content">$${latex}$$</div>
      <script type="text/javascript">
        // Function to send messages (can be kept for debugging if needed, or simplified)
        function sendMessage(type, dataValue) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, data: dataValue, latex: ${JSON.stringify(latex)} }));
        }

        // Original updateHeight function
        function updateHeight() {
          setTimeout(function() {
            var newHeight = document.body.scrollHeight;
            newHeight = Math.max(newHeight, 20); 
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'rendered_height', // Keep original type for height updates
              height: newHeight,
              latex: ${JSON.stringify(latex)} 
            }));
          }, 350); // Slightly increased timeout
        }

        // Configure MathJax and define what to do when it's ready
        window.MathJax = {
          tex: {
            inlineMath: [['$', '$'], ['\\(', '\\)']],
            displayMath: [['$$', '$$'], ['\\[', '\\]']]
          },
          startup: {
            ready: function () {
              sendMessage('mathjax_status', 'MathJax startup.ready function called.');
              MathJax.startup.defaultReady();
              sendMessage('mathjax_status', 'MathJax defaultReady executed. Typesetting should be complete.');
              updateHeight();
            }
          },
          options: {
            skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
            ignoreHtmlClass: 'tex2jax_ignore',
            processHtmlClass: 'tex2jax_process'
          }
        };

        document.addEventListener('DOMContentLoaded', function() {
            sendMessage('dom_content_loaded', 'DOMContentLoaded event fired.');
        });

        window.addEventListener('resize', updateHeight);
      </script>
      <!-- The MathJax script itself, loaded AFTER our configuration block -->
      <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" async></script>
    </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[WebView Message]', data); 

      if (data.type === 'rendered_height' && data.latex === latex) {
        setWebViewHeight(data.height + 15);
      } else if (data.type === 'mathjax_status' || data.type === 'dom_content_loaded') {
        // Already logged
      }
    } catch (error) {
      console.error('Error parsing message from WebView:', error);
    }
  };

  // Key change forces WebView to reload
  const webViewKey = `${latex}-${colorScheme}`;

  return (
    <View style={[styles.container, { height: webViewHeight, backgroundColor: effectiveBackgroundColor }]}>
      <WebView
        ref={webViewRef}
        key={webViewKey} 
        originWhitelist={['*']}
        source={{ html: htmlContent, baseUrl: '' }}
        onMessage={handleMessage}
        style={styles.webView}
        scrollEnabled={false} 
        javaScriptEnabled={true}
        domStorageEnabled={true}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error:', nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn(
            'WebView HTTP error: ',
            nativeEvent.url,
            nativeEvent.statusCode,
            nativeEvent.description,
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent', 
  },
});

export default WebViewLatexBlock;
