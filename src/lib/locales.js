const fs = require('fs')
const path = require('path')
const templatesDir = `${path.dirname(module.filename)}/tpl`

function readTemplate (filename) {
  return fs.readFileSync(`${templatesDir}/${filename}`)
}

const attachments = [
  {filename: 'image001.png',
    path: `${templatesDir}/image001.png`,
    cid: 'image001.png@01D76DC4.09699150'
  }, {filename: 'image002.gif',
    path: `${templatesDir}/image002.gif`,
    cid: 'image002.gif@01D76DC4.09699150'
  }, {filename: 'image003.gif',
    path: `${templatesDir}/image003.gif`,
    cid: 'image003.gif@01D76DC4.09699150'
  }, {filename: 'image004.gif',
    path: `${templatesDir}/image004.gif`,
    cid: 'image004.gif@01D76DC4.09699150'
  }
]

const ebAttachments = [
  {filename: 'eb_image001.png',
    path: `${templatesDir}/eb_image001.png`,
    cid: 'eb_image001.png@01D76DC4.19699150'
  }, {filename: 'eb_image003.png',
    path: `${templatesDir}/eb_image003.png`,
    cid: 'eb_image003.png@01D76DC4.19699150'
  }
]

const contactInfo = {
  ukr:
  'BigMedia/група BigBoard Ukraine \n04070, Київ, вул. Ігорівська 14-А \nТел. 044 585 15 15 \n' +
  'Site: http://www.bigmedia.ua/ \nFacebook: https://www.facebook.com/bigmediaua/ \n' +
  'Youtube: https://www.youtube.com/channel/UCBZeK1tgfg4CvhC5gJHimLw \n' +
  'Instagram: https://www.instagram.com/bigmedia.ua/',

  ru:
  'BigMedia/група BigBoard Ukraine \n04070 , Киев, ул. Игоревская 14-А \nТел. 044 585 15 15 \n' +
  'Site: http://www.bigmedia.ua/ \nFacebook: https://www.facebook.com/bigmediaua/ \n' +
  'Youtube: https://www.youtube.com/channel/UCBZeK1tgfg4CvhC5gJHimLw \n' +
  'Instagram: https://www.instagram.com/bigmedia.ua/',

  en:
  'BigMedia/BigBoard Ukraine \n04070, Kyiv, Igorivs\'ka str. 14-A \nPhone: 044 585 15 15 \n' +
  'Site: http://www.bigmedia.ua/ \nFacebook: https://www.facebook.com/bigmediaua/ \n' +
  'Youtube: https://www.youtube.com/channel/UCBZeK1tgfg4CvhC5gJHimLw \n' +
  'Instagram: https://www.instagram.com/bigmedia.ua/'
}

module.exports = {
  confirmEmail: {
    ukr: {
      subject: '✔ Код авторизації на сайті Bigmedia (ua)',
      text:
      'Шановний(а) {{name}}! \n' +
      '\n' +
      'Це повідомлення було автоматично відправлено у відповідь на використання системи відбору ' +
      'площин Bigmedia. \nДля підтвердження замовлення введіть на сайті перевірочний код: {{authCode}} \n\n' + contactInfo.ukr,
      html: readTemplate('confirmAuth_ukr.html'),
      attachments
    },
    ru: {
      subject: '✔ Код авторизации на сайте Bigmedia',
      text:
      'Уважаемый(ая) {{name}}!\n' +
      '\n' +
      'Это сообщение было автоматически отправлено в ответ на использование системы отбора плоскостей ' +
      'Bigmedia. \nДля подверждения заказа введите на сайте проверочный код: {{authCode}} \n\n' + contactInfo.ru,
      html: readTemplate('confirmAuth_ru.html'),
      attachments
    },
    en: {
      subject: '✔ Verification code on Bigmedia website',
      text:
      'Dear {{name}}!\n' +
      '\n' +
      'This message was sent automatically because of using Bigmedia sites selection system.\n' +
      'To confirm the order, enter the verification code on our website: {{authCode}}\n' +
      '\n' + contactInfo.en,
      html: readTemplate('confirmAuth_en.html'),
      attachments
    }
  },
  orderCopyEmail: {
    ukr: {
      subject: 'Площини відібрані на сайті Bigmedia',
      text: 'Шановний {{name}}! \n\nВи скористались системою вибору площин Bigmedia. \n' +
      'Ми зв\'яжемося з Вами найближчим часом. \n\nНомер замовлення: {{idOrder}} \n\n' +
      'Період рекламної кампанії: {{period}} \n\n' + contactInfo.ukr,
      html: readTemplate('orderCopy_ukr.html'),
      attachments
    },
    ru: {
      subject: 'Плоскости отобранные на сайте Bigmedia',
      text: 'Уважаемый {{name}}! \n\nВы воспользовались системой отбора плоскостей Bigmedia. \n' +
      'Мы свяжемся с Вами в ближайшее время. \n\nНомер заказа: {{idOrder}} \n\n' +
      'Период отобранных плоскостей: {{period}} \n\n' + contactInfo.ru,
      html: readTemplate('orderCopy_ru.html'),
      attachments
    },
    en: {
      subject: 'Sites selection on Bigmedia website',
      text: 'Dear {{name}}! \n\nYou have used Bigmedia sites selection system.\n' +
      'We will contact you shortly. \n\nYour order number: {{idOrder}}' +
      'Period of selected sites: {{period}} \n\n' + contactInfo.en,
      html: readTemplate('orderCopy_en.html'),
      attachments
    }
  },
  resetPasswordEmail: {
    ukr: {
      subject: 'Авторизація на cайті Bigmedia',
      text:
      'Шановний(а) {{name}}! \n' +
      '\n' +
      'Для авторизації на сайті bigmedia.ua введіть наступний код: {{authCode}}\n' +
      'Код буде дійсним протягом тридцяти хвилин\n' +
      '\n' + contactInfo.ukr,
      html: readTemplate('resetPassword_ukr.html'),
      attachments
    },
    ru: {
      subject: 'Авторизация на сайте Bigmedia',
      text:
      'Уважаемый(ая) {{name}}!\n' +
      '\n' +
      'Для авторизации на сайтe bigmedia.ua введите следующий код: {{authCode}}\n' +
      'Код будет действительным в течении тридцати минут\n' +
      '\n' + contactInfo.ru,
      html: readTemplate('resetPassword_ru.html'),
      attachments
    },
    en: {
      subject: 'Bigmedia website authorization',
      text:
      'Dear {{name}}!\n' +
      '\n' +
      'Use this code: {{authCode}} for authorization on bigmedia.ua\n' +
      'Code will be valid for thirty minutes\n' +
      '\n' + contactInfo.en,
      html: readTemplate('resetPassword_en.html'),
      attachments
    }
  },
  simplePlannerResult: {
    ukr: {
      subject: 'Пропозиція рекламної кампанії',
      text:
      'Шановний клієнт! \n' +
      '\n' +
      'Ви щойно створили рекламну кампанію на сайті bma.bigmedia.ua\n' +
      'Ми намагалися створити кампанію, яка б відповідала таким критеріям:\n' +
      '{{plannerParams}}\n' +
      'Презентацію кампанії можете подивитись за посиланням: {{pubCampaignUrl}}' +
      '\n' + contactInfo.ukr,
      html: readTemplate('simplePlannerResult_ukr.html'),
      attachments
    },
    ru: {
      subject: 'Авторизация на сайте Bigmedia',
      text:
      'Уважаемый(ая) {{name}}!\n' +
      '\n' +
      'Для авторизации на сайтe bigmedia.ua введите следующий код: {{authCode}}\n' +
      'Код будет действительным в течении тридцати минут\n' +
      '\n' + contactInfo.ru,
      html: readTemplate('resetPassword_ru.html'),
      attachments
    },
    en: {
      subject: 'Bigmedia website authorization',
      text:
      'Dear {{name}}!\n' +
      '\n' +
      'Use this code: {{authCode}} for authorization on bigmedia.ua\n' +
      'Code will be valid for thirty minutes\n' +
      '\n' + contactInfo.en,
      html: readTemplate('resetPassword_en.html'),
      attachments
    }
  },
  attachments,
  easyboardConfirmCheckout: {
    ukr: {
      subject: 'Підтвердження відбору рекламних бордів',
      text:
      'Вітаємо! \n' +
      '\n' +
      'Залишився останній крок, щоб вашу рекламу побачили усі!\n' +
      'Зовсім скоро менеджер зв’яжеться з вами.\n' +
      '\nУкраїна, Київ\n' +
      'вул. Ігорівська 14a\n' +
      '044 585 99 77\n',
      html: readTemplate('easyboardConfirmCheckout_ukr.html'),
      ebAttachments
    },
    ru: {
      subject: 'Авторизация на сайте Bigmedia',
      text:
      'Уважаемый(ая) {{name}}!\n' +
      '\n' +
      'Для авторизации на сайтe bigmedia.ua введите следующий код: {{authCode}}\n' +
      'Код будет действительным в течении тридцати минут\n' +
      '\n' + contactInfo.ru,
      html: readTemplate('resetPassword_ru.html'),
      attachments
    },
    en: {
      subject: 'Bigmedia website authorization',
      text:
      'Dear {{name}}!\n' +
      '\n' +
      'Use this code: {{authCode}} for authorization on bigmedia.ua\n' +
      'Code will be valid for thirty minutes\n' +
      '\n' + contactInfo.en,
      html: readTemplate('resetPassword_en.html'),
      attachments
    }
  },
  ebAttachments
}
