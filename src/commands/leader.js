/*
	Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.

	https://github.com/alexemanuelol/rustplusplus

*/

const { SlashCommandBuilder } = require("@discordjs/builders");
const DiscordEmbeds = require("../discordTools/discordEmbeds");
const Fuse = require("fuse.js"); // Import fuzzy matching library

module.exports = {
  name: "leader",

  getData(client, guildId) {
    return new SlashCommandBuilder()
      .setName("leader")
      .setDescription(client.intlGet(guildId, "commandsLeaderDesc"))
      .addStringOption((option) =>
        option
          .setName("member")
          .setDescription(client.intlGet(guildId, "commandsLeaderMemberDesc"))
          .setRequired(true)
      );
  },

  async execute(client, interaction) {
    const instance = client.getInstance(interaction.guildId);
    const rustplus = client.rustplusInstances[interaction.guildId];

    const verifyId = Math.floor(100000 + Math.random() * 900000);
    client.logInteraction(interaction, verifyId, "slashCommand");

    if (!(await client.validatePermissions(interaction))) return;
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.options.getString("member");

    client.log(
      client.intlGet(null, "infoCap"),
      client.intlGet(null, "slashCommandValueChange", {
        id: `${verifyId}`,
        value: `${member}`,
      })
    );

    if (!rustplus || !rustplus.isOperational) {
      const str = client.intlGet(
        interaction.guildId,
        "notConnectedToRustServer"
      );
      await interaction.editReply({
        embeds: [DiscordEmbeds.getActionInfoEmbed(1, str)],
      });
      client.log(client.intlGet(null, "warningCap"), str);
      return;
    }

    if (!rustplus.generalSettings.leaderCommandEnabled) {
      const str = client.intlGet(
        interaction.guildId,
        "leaderCommandIsDisabled"
      );
      await interaction.editReply({
        embeds: [
          DiscordEmbeds.getActionInfoEmbed(
            1,
            str,
            instance.serverList[rustplus.serverId]?.title
          ),
        ],
      });
      rustplus.log(client.intlGet(interaction.guildId, "warningCap"), str);
      return;
    }

    if (
      !Object.keys(instance.serverListLite[rustplus.serverId]).includes(
        rustplus.team.leaderSteamId
      )
    ) {
      let names = "";
      for (const player of rustplus.team.players) {
        if (
          Object.keys(instance.serverListLite[rustplus.serverId]).includes(
            player.steamId
          )
        ) {
          names += `${player.name}, `;
        }
      }
      names = names.slice(0, -2);

      const str = client.intlGet(rustplus.guildId, "leaderCommandOnlyWorks", {
        name: names,
      });
      await interaction.editReply({
        embeds: [
          DiscordEmbeds.getActionInfoEmbed(
            1,
            str,
            instance.serverList[rustplus.serverId]?.title
          ),
        ],
      });
      rustplus.log(client.intlGet(interaction.guildId, "warningCap"), str);
      return;
    }

    //Fuzzy search for the player
    const fuse = new Fuse(rustplus.team.players, {
      keys: ["name"],
      threshold: 0.3,
    });
    const searchResults = fuse.search(member);

    if (searchResults.length === 0) {
      const str = client.intlGet(
        interaction.guildId,
        "couldNotIdentifyMember",
        { name: member }
      );
      await interaction.editReply({
        embeds: [
          DiscordEmbeds.getActionInfoEmbed(
            1,
            str,
            instance.serverList[rustplus.serverId]?.title
          ),
        ],
      });
      rustplus.log(client.intlGet(interaction.guildId, "warningCap"), str);
      return;
    }

    const player = searchResults[0].item;

    if (rustplus.team.leaderSteamId === player.steamId) {
      const str = client.intlGet(interaction.guildId, "leaderAlreadyLeader", {
        name: player.name,
      });
      await interaction.editReply({
        embeds: [
          DiscordEmbeds.getActionInfoEmbed(
            1,
            str,
            instance.serverList[rustplus.serverId]?.title
          ),
        ],
      });
      rustplus.log(client.intlGet(interaction.guildId, "warningCap"), str);
      return;
    }

    if (
      rustplus.generalSettings.leaderCommandOnlyForPaired &&
      !Object.keys(instance.serverListLite[rustplus.serverId]).includes(
        player.steamId
      )
    ) {
      const str = client.intlGet(
        rustplus.guildId,
        "playerNotPairedWithServer",
        { name: player.name }
      );
      await interaction.editReply({
        embeds: [
          DiscordEmbeds.getActionInfoEmbed(
            1,
            str,
            instance.serverList[rustplus.serverId]?.title
          ),
        ],
      });
      rustplus.log(client.intlGet(interaction.guildId, "warningCap"), str);
      return;
    }

    if (rustplus.team.leaderSteamId === rustplus.playerId) {
      await rustplus.team.changeLeadership(player.steamId);
    } else {
      await rustplus.leaderRustPlusInstance.promoteToLeaderAsync(
        player.steamId
      );
    }

    const str = client.intlGet(interaction.guildId, "leaderTransferred", {
      name: player.name,
    });
    await interaction.editReply({
      embeds: [
        DiscordEmbeds.getActionInfoEmbed(
          0,
          str,
          instance.serverList[rustplus.serverId]?.title
        ),
      ],
    });
    rustplus.log(client.intlGet(interaction.guildId, "infoCap"), str);
  },
};
