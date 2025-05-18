document.addEventListener('DOMContentLoaded', function () {
    const toggleButtons = document.querySelectorAll('.preview-toggle');

    toggleButtons.forEach(button => {
        button.addEventListener('click', function () {
            const targetId = this.dataset.previewTarget;
            const targetContent = document.getElementById(targetId);

            if (targetContent) {
                if (targetContent.style.display === 'none' || targetContent.style.display === '') {
                    targetContent.style.display = 'block';
                    this.textContent = 'Скрыть превью';
                } else {
                    targetContent.style.display = 'none';
                    this.textContent = 'Показать превью';
                }
            }
        });
    });

    // Theme switching code
    const themeSwitcher = document.getElementById('theme-switcher');
    const currentTheme = localStorage.getItem('theme') || 'dark';

    if (currentTheme === 'light') {
        document.body.classList.add('light-theme');
    }

    themeSwitcher.addEventListener('click', function () {
        document.body.classList.toggle('light-theme');
        const theme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
        localStorage.setItem('theme', theme);
    });
});
