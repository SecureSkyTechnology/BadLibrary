function logout (evt) {
  const form = document.getElementById('form-logout')
  if (form) {
    form.submit()
    evt.preventDefault()
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const elm = document.getElementById('logout')
  if (elm) {
    elm.addEventListener('click', logout, false)
  }
}, false)
