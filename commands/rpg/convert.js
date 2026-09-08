const TaxSystem = require('../../rpg/utils/TaxSystem');
const { updatePlayerNexus } = require('../../rpg/utils/NexusManager');
const SEP = '━━━━━━━━━━━━━━━━━━━━━━━━━━━';

module.exports = {
  name: 'convert',
  description: 'Convert between Nexus, Mana Stones, and Upgrade Points',
  async execute(sock, msg, args, getDatabase, saveDatabase, sender) {
    const chatId = msg.key.remoteJid;
    const db = getDatabase();
    const player = db.users[sender];
    if (!player) return sock.sendMessage(chatId, { text: '❌ Not registered!' }, { quoted: msg });

    const action = args[0]?.toLowerCase();
    const amount = parseInt(args[1]);

    if (!action || !['gold','nexus','g','n','crystal','crystals','c','up','fromup'].includes(action)) {
      return sock.sendMessage(chatId, { text:
        SEP + '\n💱 CURRENCY EXCHANGE 💱\n' + SEP + '\n' +
        '💠 Nexus: ' + (player.gold||0).toLocaleString() + '\n' +
        '💎 Mana Stones: ' + (player.manaCrystals||0) + '\n' +
        '⬆️ Upgrade Points: ' + (player.upgradePoints||0) + '\n' +
        SEP + '\n📊 RATES\n' + SEP + '\n' +
        '💎→💠  1 Mana Stone = 10 Nexus\n' +
        '💠→💎  100 Nexus = 1 Mana Stone\n' +
        '💎→⬆️  1000 Mana Stones = 1 UP\n' +
        '⬆️→💎  1 UP = 1000 Mana Stones\n' +
        SEP + '\n📌 /convert Nexus [n]    crystals→Nexus\n' +
        '📌 /convert crystal [n] Nexus→crystals\n' +
        '📌 /convert up [n]      crystals→UP\n' +
        '📌 /convert fromup [n]  UP→crystals\n' + SEP
      }, { quoted: msg });
    }

    if (action === 'gold' || action === 'g' || action === 'nexus' || action === 'n') {
      if (!amount||amount<=0) return sock.sendMessage(chatId,{text:'❌ Specify amount! e.g. /convert Nexus 100'},{quoted:msg});
      if ((player.manaCrystals||0)<amount) return sock.sendMessage(chatId,{text:'❌ Not enough crystals! Have: '+(player.manaCrystals||0)},{quoted:msg});
      const totalNexus = amount*10;
      const taxAmount = TaxSystem.applyTax(db,totalNexus,'gold',saveDatabase);
      const goldGained = totalNexus-taxAmount;
      player.manaCrystals -= amount;
      updatePlayerNexus(player,goldGained,saveDatabase);
      return sock.sendMessage(chatId,{text: SEP+'\n✅ Mana Stones → Nexus\n'+SEP+'\n💎 Spent: '+amount+' Mana Stones\n💠 Got: '+goldGained.toLocaleString()+' Nexus (after 5% fee)\n💠 Nexus: '+(player.gold||0).toLocaleString()+'\n💎 Mana Stones: '+(player.manaCrystals||0)+'\n'+SEP},{quoted:msg});
    }

    if (action === 'crystal' || action === 'crystals' || action === 'c') {
      if (!amount||amount<=0) return sock.sendMessage(chatId,{text:'❌ Specify amount! e.g. /convert crystal 500'},{quoted:msg});
      if (amount%100!==0) return sock.sendMessage(chatId,{text:'❌ Must be multiples of 100!'},{quoted:msg});
      if ((player.gold||0)<amount) return sock.sendMessage(chatId,{text:'❌ Not enough Nexus!'},{quoted:msg});
      const crystalsGained = Math.floor(amount/100);
      TaxSystem.applyTax(db,amount,'gold',saveDatabase);
      updatePlayerNexus(player,-amount,saveDatabase);
      player.manaCrystals = (player.manaCrystals||0)+crystalsGained;
      saveDatabase();
      return sock.sendMessage(chatId,{text: SEP+'\n✅ Nexus → Mana Stones\n'+SEP+'\n💠 Spent: '+amount.toLocaleString()+' Nexus\n💎 Got: '+crystalsGained+' Mana Stones\n💠 Nexus: '+(player.gold||0).toLocaleString()+'\n💎 Mana Stones: '+(player.manaCrystals||0)+'\n'+SEP},{quoted:msg});
    }

    if (action === 'up') {
      if (!amount||amount<=0) return sock.sendMessage(chatId,{text:'❌ Specify crystals! e.g. /convert up 1000'},{quoted:msg});
      if (amount%1000!==0) return sock.sendMessage(chatId,{text:'❌ Must be multiples of 1000!'},{quoted:msg});
      if ((player.manaCrystals||0)<amount) return sock.sendMessage(chatId,{text:'❌ Not enough crystals!'},{quoted:msg});
      const upGained = Math.floor(amount/1000);
      player.manaCrystals -= amount;
      player.upgradePoints = (player.upgradePoints||0)+upGained;
      saveDatabase();
      return sock.sendMessage(chatId,{text: SEP+'\n✅ Mana Stones → UP\n'+SEP+'\n💎 Spent: '+amount+' Mana Stones\n⬆️ Got: '+upGained+' Upgrade Point'+(upGained>1?'s':'')+'\n💎 Mana Stones: '+player.manaCrystals+'\n⬆️ UP: '+player.upgradePoints+'\n'+SEP+'\n💡 Use /upgrade to spend UP!'},{quoted:msg});
    }

    if (action === 'fromup') {
      if (!amount||amount<=0) return sock.sendMessage(chatId,{text:'❌ Specify UP amount! e.g. /convert fromup 1'},{quoted:msg});
      if ((player.upgradePoints||0)<amount) return sock.sendMessage(chatId,{text:'❌ Not enough UP! Have: '+(player.upgradePoints||0)},{quoted:msg});
      const crystalsGained = amount*1000;
      player.upgradePoints -= amount;
      player.manaCrystals = (player.manaCrystals||0)+crystalsGained;
      saveDatabase();
      return sock.sendMessage(chatId,{text: SEP+'\n✅ UP → Mana Stones\n'+SEP+'\n⬆️ Spent: '+amount+' UP\n💎 Got: '+crystalsGained.toLocaleString()+' Mana Stones\n⬆️ UP: '+player.upgradePoints+'\n💎 Mana Stones: '+player.manaCrystals+'\n'+SEP},{quoted:msg});
    }

    return sock.sendMessage(chatId,{text:'❌ Invalid option! Use /convert to see menu.'},{quoted:msg});
  }
};
