for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    await navigator.clipboard.writeText(button.dataset.copy ?? '')
    const label = button.querySelector('b')
    if (!label) return
    label.textContent = 'Copied'
    setTimeout(() => { label.textContent = 'Copy' }, 1400)
  })
}
