document.getElementById('loginForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const adminName = document.getElementById('adminName').value;
            
            if (adminName.trim()) {
                // Add a simple loading state
                const btn = document.querySelector('.sign-in-btn');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<span>Signing in...</span>';
                btn.style.opacity = '0.7';
                btn.disabled = true;
                
                // Simulate sign in process
                setTimeout(() => {
                    alert('Welcome, ' + adminName + '! Sign in successful.');
                    btn.innerHTML = originalText;
                    btn.style.opacity = '1';
                    btn.disabled = false;
                    localStorage.setItem("adminName", adminName);
                    window.location.href = "admin.html";
                }, 1000);
            }
        });

        // Add input animation
        document.getElementById('adminName').addEventListener('focus', function() {
            this.parentElement.style.transform = 'scale(1.02)';
        });

        document.getElementById('adminName').addEventListener('blur', function() {
            this.parentElement.style.transform = 'scale(1)';
        });