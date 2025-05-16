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
});
