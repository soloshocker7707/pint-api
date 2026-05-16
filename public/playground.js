document.addEventListener('DOMContentLoaded', () => {
    const SUPABASE_URL = 'https://cvsdvxygucjbbtyydgmx.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_C32o3FATbcSmVNhxZyCRgA_0pjUX_Lr';
    const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

    const renderBtn = document.getElementById('render-btn');
    const targetUrlInput = document.getElementById('target-url');
    const previewArea = document.getElementById('preview-area');
    const placeholderText = document.getElementById('placeholder-text');
    const renderStatus = document.getElementById('render-status');
    const errorDisplay = document.getElementById('error-display');
    const debugInfo = document.getElementById('debug-info');
    const debugContent = document.getElementById('debug-content');

    let userApiKey = null;

    // Check Auth and get API Key
    if (supabase) {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
                const { data } = await supabase.from('profiles').select('api_key').single();
                if (data) userApiKey = data.api_key;
            } else {
                renderBtn.disabled = true;
                renderBtn.textContent = 'Login to Test';
                errorDisplay.textContent = 'You must be logged in to use the playground.';
                errorDisplay.style.display = 'block';
            }
        });
    }

    renderBtn.addEventListener('click', async () => {
        if (!userApiKey) {
            alert('Please login to get your API key.');
            return;
        }

        const url = targetUrlInput.value;
        if (!url) return;

        // Setup UI
        renderBtn.disabled = true;
        renderStatus.style.display = 'block';
        placeholderText.style.display = 'none';
        errorDisplay.style.display = 'none';
        debugInfo.style.display = 'none';
        
        const options = {
            url: url,
            clean: document.getElementById('opt-clean').checked,
            wait: document.getElementById('opt-wait').checked ? 'smart' : 'networkidle2',
            freezeAnimations: document.getElementById('opt-freeze').checked,
            debug: document.getElementById('opt-debug').checked
        };

        try {
            // Call our Zuplo API
            const response = await fetch('https://pint-api-panel-main-87c9a67.zuplo.app/v1/screenshot/capture', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': userApiKey
                },
                body: JSON.stringify(options)
            });

            const result = await response.json();

            if (result.success) {
                previewArea.innerHTML = `<img src="data:image/png;base64,${result.image_base64}" alt="Render result">`;
                
                if (result.debug) {
                    debugInfo.style.display = 'block';
                    debugContent.innerHTML = `<pre>${JSON.stringify(result.debug, null, 2)}</pre>`;
                }
            } else {
                throw new Error(result.message || 'Render failed');
            }
        } catch (err) {
            console.error('Playground Error:', err);
            errorDisplay.textContent = `Error: ${err.message}`;
            errorDisplay.style.display = 'block';
            placeholderText.style.display = 'block';
            previewArea.innerHTML = '';
        } finally {
            renderBtn.disabled = false;
            renderStatus.style.display = 'none';
        }
    });
});
