export interface TemplateSuggestion {
  memories: string[];
  messages: string[];
}

export const TEMPLATES: Record<string, Record<string, TemplateSuggestion>> = {
  quinceanera: {
    es: {
      memories: [
        "Cuando bailamos juntos en tu ensayo y no podías de la risa por los pasos equivocados.",
        "El día que te probaste el vestido por primera vez y tus ojos brillaron de emoción.",
        "Cuando jugabas en el patio de pequeña y decías que querías que este día llegara volando."
      ],
      messages: [
        "Que esta nueva etapa de tu vida esté llena de sueños cumplidos y alegría infinita, {name}.",
        "Siempre serás nuestra princesa, camina con orgullo y alcanza cada una de tus metas.",
        "Que la magia y felicidad de tus quince años te acompañe en cada paso que des."
      ]
    },
    en: {
      memories: [
        "When we danced together at your rehearsal and couldn't stop laughing at our wrong steps.",
        "The day you tried on your dress for the first time and your eyes shined with pure excitement.",
        "When you were playing in the backyard as a little girl, dreaming of this day."
      ],
      messages: [
        "May this new chapter of your life be filled with fulfilled dreams and endless joy, {name}.",
        "You will always be our princess, walk with pride and reach for the stars.",
        "May the happiness of your fifteenth birthday guide you in everything you do."
      ]
    },
    mix: {
      memories: [
        "When we danced together at your ensayo and laughed so much at the choreography.",
        "El día que escogiste tu dress and your eyes shined with excitement.",
        "When you were a little girl and always talked about this beautiful day."
      ],
      messages: [
        "Que esta nueva etapa be filled with love, laughter, and endless dreams, {name}.",
        "You will always be our princess, never forget how much te amamos.",
        "May the happiness of your quinceañera stay with you forever."
      ]
    }
  },
  boda: {
    es: {
      memories: [
        "El día que se conocieron y cómo no dejaban de hablar a pesar de que el café ya se había enfriado.",
        "Ese viaje por carretera donde nos perdimos pero terminamos cantando a todo pulmón bajo la lluvia.",
        "Cuando anunciaron su compromiso y todos lloramos de la emoción al verlos tan felices."
      ],
      messages: [
        "Que su amor crezca más fuerte con cada amanecer. ¡Felicidades en su boda, {name}!",
        "Deseándoles una vida entera llena de risas, complicidad y aventuras juntos.",
        "Que este sea solo el hermoso comienzo de una gran y eterna historia de amor."
      ]
    },
    en: {
      memories: [
        "The day you first met and how you kept talking even after the coffee got cold.",
        "That road trip where we got completely lost but ended up singing at the top of our lungs.",
        "When you announced your engagement and we all cried tears of joy seeing you both."
      ],
      messages: [
        "May your love grow stronger with each passing day. Congratulations on your wedding, {name}!",
        "Wishing you a lifetime of laughter, deep connection, and beautiful adventures together.",
        "May this day be the starting point of a wonderful and eternal love story."
      ]
    },
    mix: {
      memories: [
        "El día que se conocieron and how you talked for hours over cold coffee.",
        "That road trip where we got lost but ended up cantando en la lluvia.",
        "When you announced the compromise y todos lloramos de pura felicidad."
      ],
      messages: [
        "May your love grow stronger cada día. ¡Felicidades en su boda, {name}!",
        "Wishing you a lifetime of risas, complicidad, and beautiful adventures together.",
        "Que este sea el comienzo of a wonderful and eternal love story."
      ]
    }
  },
  cumpleanos: {
    es: {
      memories: [
        "La fiesta sorpresa del año pasado cuando casi descubres todo antes de tiempo.",
        "Cuando cocinamos ese pastel gigante que terminó hundiéndose en el centro pero sabía riquísimo.",
        "Las tardes enteras que pasamos hablando de la vida en la sala compartiendo un café."
      ],
      messages: [
        "¡Feliz cumpleaños, {name}! Que la vida te regale tanta felicidad como la que tú nos das.",
        "Brindo por otro año de risas compartidas, salud y sueños cumplidos.",
        "Que hoy celebres en grande y que este año nuevo sea el mejor de todos."
      ]
    },
    en: {
      memories: [
        "The surprise party last year when you almost caught us decorating beforehand.",
        "When we baked that giant cake that sank in the middle but still tasted amazing.",
        "The long afternoons we spent chatting about life in the living room sharing coffee."
      ],
      messages: [
        "Happy birthday, {name}! May life bring you as much happiness as you bring to all of us.",
        "Here's to another year of shared laughter, great health, and realized dreams.",
        "May you celebrate big today and may this new year of life be your best one yet."
      ]
    },
    mix: {
      memories: [
        "La fiesta sorpresa last year when you almost caught us before the surprise.",
        "When we baked that cake that sank in the middle pero sabía riquísimo.",
        "The long afternoons sharing coffee and platicando sobre la vida."
      ],
      messages: [
        "¡Happy birthday, {name}! Que la vida te regale mucha salud y felicidad.",
        "Here's to another year of risas, abrazos, and realized dreams.",
        "Celebra en grande today, and may this year be your best one yet."
      ]
    }
  },
  serenata: {
    es: {
      memories: [
        "Nuestra primera caminata bajo la luna donde perdimos la noción del tiempo.",
        "La primera vez que me tomaste la mano y sentí que el mundo se detenía.",
        "Cuando compartimos ese helado bajo la lluvia y terminamos empapados y felices."
      ],
      messages: [
        "Te amo más de lo que las palabras o las canciones pueden expresar, {name}.",
        "Eres mi presente y el futuro que elijo todos los días de mi vida.",
        "Esta melodía es para decirte que mi corazón la te más fuerte por ti."
      ]
    },
    en: {
      memories: [
        "Our first walk under the moonlight where we completely lost track of time.",
        "The first time you held my hand and it felt like the entire world stood still.",
        "When we shared that ice cream in the rain and ended up soaked but happy."
      ],
      messages: [
        "I love you more than words or songs can ever express, {name}.",
        "You are my present and the future I choose to walk every single day.",
        "This melody is to tell you that my heart beats faster just for you."
      ]
    },
    mix: {
      memories: [
        "Nuestra primera caminata under the moonlight where we lost track of time.",
        "The first time you held my hand y sentí que el mundo se detenía.",
        "Sharing that ice cream in the rain y terminar empapados pero muy felices."
      ],
      messages: [
        "I love you más de lo que las palabras or songs can express, {name}.",
        "Eres mi presente and the future that I choose every single day.",
        "Esta canción es para ti, to show you how much you mean to me."
      ]
    }
  },
  diaMadres: {
    es: {
      memories: [
        "Cómo siempre me esperabas con mi comida favorita cuando regresaba cansado.",
        "Tus conseils sabios por las mañanas y tu abrazo cálido que cura cualquier tristeza.",
        "Cuando cantabas en la cocina los domingos por la mañana ordenando la casa."
      ],
      messages: [
        "Feliz Día de las Madres, {name}. Gracias por ser el pilar y el amor de nuestra familia.",
        "Tu fuerza y tu ternura me han enseñado a ser quien soy. Te amo con toda mi alma.",
        "Que hoy te llenemos de mimos y cariño, porque te mereces el universo entero."
      ]
    },
    en: {
      memories: [
        "How you always welcomed me home with my favorite meal when I was tired.",
        "Your wise advice in the mornings and your warm hug that cures any sadness.",
        "When you used to sing in the kitchen on Sunday mornings while organizing the house."
      ],
      messages: [
        "Happy Mother's Day, {name}. Thank you for being the pillar and love of our family.",
        "Your strength and tenderness have taught me how to be who I am. I love you deeply.",
        "May we shower you with love and affection today, because you deserve the universe."
      ]
    },
    mix: {
      memories: [
        "How you always waited for me con mi comida favorita when I was tired.",
        "Your wise consejos in the morning and your warm hug that heals everything.",
        "When you sang in the kitchen los domingos por la mañana."
      ],
      messages: [
        "Happy Mother's Day, {name}. Gracias por ser el pilar de nuestra familia.",
        "Your strength and your love me han hecho quien soy hoy. Te amo, Mamá.",
        "You deserve the universe today and always. ¡Te consentiremos mucho hoy!"
      ]
    }
  },
  graduacion: {
    es: {
      memories: [
        "Las noches interminables de estudio compartiendo pizzas y tazas infinitas de café.",
        "Cuando recibiste la carta de aceptación y saltamos de alegría en la cocina.",
        "El momento en que subiste al escenario a recibir tu diploma y se nos llenaron los ojos de lágrimas."
      ],
      messages: [
        "¡Felicidades por tu graduación, {name}! El futuro te espera y sé que vas a brillar.",
        "Muy orgulloso de tu dedicación, paciencia y esfuerzo. Esto es solo el comienzo.",
        "Que este logro sea la llave que abra las puertas de todos tus grandes sueños."
      ]
    },
    en: {
      memories: [
        "The endless study nights sharing pizzas and infinite cups of coffee.",
        "When you received the acceptance letter and we jumped of joy in the kitchen.",
        "The moment you walked up the stage to receive your diploma and our eyes filled with tears."
      ],
      messages: [
        "Congratulations on your graduation, {name}! The future awaits and I know you will shine.",
        "So proud of your dedication, patience, and hard work. This is just the beginning.",
        "May this achievement be the key that opens the doors to all of your biggest dreams."
      ]
    },
    mix: {
      memories: [
        "Those endless study nights compartiendo pizza and infinite cups of café.",
        "When you got the acceptance letter y saltamos de alegría en la cocina.",
        "The moment you walked up to get your diploma y se nos salieron las lágrimas."
      ],
      messages: [
        "Congratulations on your graduation, {name}! El futuro es tuyo y vas a brillar.",
        "We are so proud of your dedication and hard work. ¡Esto es solo el comienzo!",
        "May this achievement open the doors to all of your biggest sueños."
      ]
    }
  },
  declaracion: {
    es: {
      memories: [
        "El día que cruzamos miradas por primera vez y sentí una conexión instantánea.",
        "Cuando conversamos durante horas bajo la lluvia sin importar el frío.",
        "La forma en que sonríes cada vez que te cuento mis chistes malos."
      ],
      messages: [
        "Me gustas de una manera que no puedo explicar, solo sé que quiero estar contigo, {name}.",
        "Quiero ser la persona que dibuje una sonrisa en tu rostro todos los días.",
        "Con esta canción te abro mi corazón con la esperanza de caminar juntos."
      ]
    },
    en: {
      memories: [
        "The day our eyes first met and I felt an instant connection.",
        "When we talked for hours in the rain, completely ignoring the cold.",
        "The way you smile every time I tell you my silly jokes."
      ],
      messages: [
        "I like you in a way I can't quite explain, I just know I want to be with you, {name}.",
        "I want to be the one who puts a beautiful smile on your face every single day.",
        "With this song, I open my heart to you with the hope of walking together."
      ]
    },
    mix: {
      memories: [
        "El día que cruzamos miradas for the first time and felt a special connection.",
        "Talking for hours in the rain sin importar el frío que hacía.",
        "The way you smile every time que te cuento mis chistes malos."
      ],
      messages: [
        "I like you so much, {name}. Solo sé que quiero estar a tu lado.",
        "I want to be the one who makes you smile cada día de tu vida.",
        "Con esta canción te abro mi corazón, hoping we can start something beautiful."
      ]
    }
  },
  sanValentin: {
    es: {
      memories: [
        "Ese San Valentín improvisado en casa donde quemamos la cena pero nos reímos toda la noche.",
        "Cuando nos quedamos dormidos viendo películas y abrazados en el sillón.",
        "Nuestras escapadas de fin de semana donde el destino no importaba, solo estar juntos."
      ],
      messages: [
        "Feliz San Valentín, {name}. Eres el regalo más hermoso que la vida me ha dado.",
        "Gracias por amar mis imperfecciones y hacer de cada día algo especial.",
        "Mi amor por ti no cabe en un solo día, te elijo hoy y todos los días de mi vida."
      ]
    },
    en: {
      memories: [
        "That improvised Valentine's Day at home where we burnt dinner but laughed all night.",
        "When we fell asleep watching movies, cuddled up together on the couch.",
        "Our weekend getaways where the destination didn't matter, only being together."
      ],
      messages: [
        "Happy Valentine's Day, {name}. You are the most beautiful gift life has given me.",
        "Thank you for loving my flaws and making every single day feel special.",
        "My love for you can't fit in just one day, I choose you today and every day of my life."
      ]
    },
    mix: {
      memories: [
        "That improvised San Valentín where we burnt dinner pero nos reímos toda la noche.",
        "When we fell asleep watching movies, acurrucados en el sofá.",
        "Our weekend getaways where the destination didn't matter, solo estar juntos."
      ],
      messages: [
        "Happy Valentine's Day, {name}. Eres el regalo más hermoso de mi vida.",
        "Thank you for loving my flaws and making every single day feel so special.",
        "Te amo hoy y todos los días of my life. ¡Feliz Día de la Amistad y el Amor!"
      ]
    }
  },
  bautizo: {
    es: {
      memories: [
        "La primera vez que te sostuvimos en brazos y sentimos tu respiración tan pequeñita.",
        "Ese primer bostezo y tu manita apretando fuerte nuestro dedo.",
        "Cuando vimos tu carita iluminada de paz durante la ceremonia rodeado de amor."
      ],
      messages: [
        "Que Dios bendiga siempre tu camino y te llene de luz y amor, {name}.",
        "Prometemos guiarte, cuidarte y estar para ti en cada paso de tu crecimiento.",
        "Que este bautizo sea el inicio de una vida llena de bendiciones, paz y felicidad."
      ]
    },
    en: {
      memories: [
        "The first time we held you in our arms and felt your tiny, soft breathing.",
        "That very first yawn and your little hand gripping our finger tightly.",
        "When we saw your peaceful little face illuminated during the ceremony surrounded by love."
      ],
      messages: [
        "May God always bless your path and fill your life with light and love, {name}.",
        "We promise to guide you, protect you, and be there for you as you grow.",
        "May this baptism be the beginning of a life filled with blessings, peace, and happiness."
      ]
    },
    mix: {
      memories: [
        "La primera vez que te cargamos and felt your tiny, soft breathing.",
        "That first yawn y tu manita agarrando fuerte nuestro dedo.",
        "When we saw your little face lleno de paz durante la ceremonia."
      ],
      messages: [
        "May God bless your path always and fill you with light and love, {name}.",
        "Prometemos cuidarte, guiarte, and always be there for you as you grow.",
        "Que esta bendición accompany you throughout your entire life."
      ]
    }
  },
  otro: {
    es: {
      memories: [
        "Ese día que pasamos cantando canciones viejas en la cocina mientras hacíamos la cena.",
        "Cuando nos quedamos atrapados en el tráfico durante horas y terminamos contándonos secretos.",
        "Las risas compartidas por chat a mitad de la noche por chistes internos que solo nosotros entendemos."
      ],
      messages: [
        "Esta canción es una muestra de lo mucho que te aprecio y valoro tu presencia, {name}.",
        "Gracias por estar siempre ahí, en las buenas y en las malas. Te quiero mucho.",
        "Que esta melodía te alegre el día y te recuerde lo especial que eres para mí."
      ]
    },
    en: {
      memories: [
        "That day we spent singing old songs in the kitchen while making dinner.",
        "When we got stuck in traffic for hours and ended up sharing secrets.",
        "The laughter shared in late-night chats over inside jokes only we understand."
      ],
      messages: [
        "This song is a small token of how much I appreciate and value having you in my life, {name}.",
        "Thank you for always being there, through thick and thin. I care about you deeply.",
        "May this melody brighten your day and remind you of how special you are to me."
      ]
    },
    mix: {
      memories: [
        "Singing old songs together en la cocina while cooking dinner.",
        "When we got stuck in traffic and ended up contándonos secretos.",
        "Late-night chats riéndonos de chistes internos that only we understand."
      ],
      messages: [
        "This song is to show you how much te aprecio y valoro in my life, {name}.",
        "Thank you for always being there, en las buenas y en las malas.",
        "May this melody brighten your day y te recuerde lo especial que eres."
      ]
    }
  }
};
