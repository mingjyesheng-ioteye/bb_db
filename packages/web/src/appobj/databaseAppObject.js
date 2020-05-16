import React from 'react';
import _ from 'lodash';
import { DatabaseIcon } from '../icons';
import { DropDownMenuItem } from '../modals/DropDownMenu';
import { openNewTab } from '../utility/common';

function Menu({ data, setOpenedTabs }) {
  const { connection, name } = data;
  const tooltip = `${connection.displayName || connection.server}\n${name}`;

  const handleNewQuery = () => {
    openNewTab(setOpenedTabs, {
      title: 'Query',
      icon: 'sql.svg',
      tooltip,
      tabComponent: 'QueryTab',
      props: {
        conid: connection._id,
        database: name,
      },
    });
  };

  return (
    <>
      <DropDownMenuItem onClick={handleNewQuery}>New query</DropDownMenuItem>
    </>
  );
}

const databaseAppObject = (flags) => ({ name, connection }) => {
  const { boldCurrentDatabase } = flags || {};
  const title = name;
  const key = name;
  const Icon = DatabaseIcon;
  const isBold = boldCurrentDatabase
    ? ({ currentDatabase }) => {
        return (
          _.get(currentDatabase, 'connection._id') == _.get(connection, '_id') && _.get(currentDatabase, 'name') == name
        );
      }
    : null;

  return { title, key, Icon, Menu, isBold };
};

export default databaseAppObject;
