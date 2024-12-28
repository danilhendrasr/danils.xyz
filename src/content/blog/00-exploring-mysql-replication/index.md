---
title: "Exploring MySQL Replication"
description: "From simple replication, chained replication, to highly-available group replication"
date: "2024-05-19"
tags:
  - Software Engineering
  - Database
  - SQL
  - MySQL
---

## Background

In the world of modern computing, it's quite clear that the trend is towards more and more distributed systems. Whether it's systems originally designed as distributed systems or non-distributed systems adapted to become distributed due to high workload demands, both are increasingly common. This is inevitable because the only way to handle massive workloads that a single machine can't manage due to hardware limitations is by distributing the workload across several or many computers. One type of software that is usually designed from the start to be capable of operating in a distributed manner is database systems.

Replication is one feature that is usually used when the benefit of distributed system is needed in a database systems. With replication the system can be set up so that it is more resistant to component failure, handle more workload by spreading the responsibility, and more resilient in the face of natural disasters.

I've always been familiar with the concept of database replication but never really try to get hands-on myself. So last week I thought, "Why not try it out?" After all, it will also be of great value to me if my familiarity with this important feature of modern databases increases. However, I wanted to get a more comprehensive understanding of MySQL replication mechanisms, so I decided to try several configurations and topologies instead of just one. This article is a recap of my exploration.

## Two Methods of Replication in MySQL

In MySQL database systems, replication can be done using two methods: the binlog-based replication method and the GTID-based (Global Transaction Identifier) replication method.

The binlog method has been supported by MySQL for a long time, this was the default method before the GTID-based replication was introduced. This method uses a file called the binlog, which records changes that occur in a MySQL database. The database acting as a replica reads data from this binlog file and applies the changes. When doing replication using this method, we need to determine the position in the binlog by which to start the replication, so there's a little bookkeeping needed.

On the other hand, the GTID-based replication method is newer and was introduced in MySQL 5.6. Essentially, this replication mechanism also relies on the binlog, but as database administrators, we do not need to specify the binlog position when setting up replication. This makes the replication process simpler and smoother.

However, the basic replication flow is essentially the same, as illustrated by the following diagram:

![](/blogs/00/1.png)

## Exploring Replications

My exploration involved experimenting with setting up MySQL replication using various combinations of methods, configurations, and topologies. Here is the complete list:

1. Simple replication with the binlog method
2. Simple replication with the GTID method
3. Chained replication with the binlog method
4. Chained replication with the GTID method
5. Chained replication with both binlog and GTID methods
6. Group replication
7. Group replication with InnoDB Cluster

In short, the setups I tried can be categorized into three types: simple replication, chained replication, and group replication. Each of my explorations was based on Docker Compose to make it easier to replicate and reproduce.

## Simple Replication

In this setup, I performed replication involving only two databases: Primary and Secondary, where the Secondary replicates from the Primary.

![](/blogs/00/2.png)

### Simple Replication Using Binlog

This simple replication setup is quite easy to configure. For the binlog-based method, just add the following two lines to the mysqld configuration file on the database instance designated as the Primary instance:

```apache
[mysqld]
server_id = 1
binlog_do_db = database1
```

The `server_id` configuration is used to set the ID of the database instance; this value must be unique across instances. The `binlog_do_db` configuration is used to specify which database's changes should be recorded in the binlog.

After setting up the Primary instance configuration, for the Secondary instance, you only need to add the `server_id` configuration with a value different from the `server_id` of the Primary database instance:

```apache
[mysqld]
server_id = 2
```

To connect the Secondary instance to the Primary instance, run the following command:

```sql
CHANGE REPLICATION SOURCE TO
    SOURCE_HOST = '<primary host>',
    SOURCE_USER = '<user with replication privilege>',
    SOURCE_PASSWORD = '<password of the user>',
    SOURCE_LOG_FILE = '<binlog of the primary instancen>',
    SOURCE_LOG_POS = <the position in the binlog by which to start the replication>;
```

As seen above, there needs to be a special user with replication privileges on the Primary instance that the Secondary instance can use to connect. There are plenty of references online on how to create such a user, so I won't detail it here.

Additionally, there are other variables required, such as `SOURCE_LOG_FILE` and `SOURCE_LOG_POS`. These variables relate to the binlog name and the binlog position where replication will start. You can get this information by running the following SQL command on the Primary instance:

```sql
SHOW BINARY LOG STATUS;
```

Which will produce the following output:

![](/blogs/00/3.png)

The value from the `File` column is for the `SOURCE_LOG_FILE` variable, while the value from the `Position` column is for the `SOURCE_LOG_POS` variable.

Then, to actually start the replication, run the following SQL command:

```sql
START REPLICATION;
```

The replication status can be checked using the following command:

```sql
SHOW REPLICA STATUS;
```

If the replication is running, the value in the `Replica_IO_State` column should be as follows:

![](/blogs/00/4.png)

### Simple Replication Using GTID

For the process of preparing simple replication using the GTID method, the configuration required is simpler than using the binlog method. Here is the mysqld configuration file for this method for the Primary instance:

```apache
[mysqld]
server_id = 1
gtid_mode = ON
enforce_gtid_consistency = ON
```

Meanwhile, here is the configuration for the Secondary instance:

```apache
[mysqld]
server_id = 2
gtid_mode = ON
enforce_gtid_consistency = ON
```

In short, both instances have the same configuration except for the server_id value, which must be different for each instance.

The process to start replication from Primary to Secondary is also easier than the binlog method; simply run the following SQL command on the Secondary instance:

```sql
CHANGE REPLICATION SOURCE TO
    SOURCE_HOST = '<primary host>',
    SOURCE_USER = '<user with replication privilege>',
    SOURCE_PASSWORD = '<password of the user>',
    SOURCE_AUTO_POSITION = 1;
```

Replication will automatically start without having to run the `START REPLICATION` command. As with the binlog method, the replication status can be checked by running the following command on the Secondary instance:

```sql
SHOW REPLICA STATUS;
```

## Chained Replication

In this setup, my exploration involves 3 MySQL databases: Primary, Secondary 1, and Secondary 2. Secondary 1 replicates from Primary, and Secondary 2 replicates from Secondary 1.

![](/blogs/00/5.png)

### Mixed Chained Replication

For chained replication, I will only describe mixed chained replication because, essentially, the steps for chained replication using one method are the same as for simple replication mentioned above, with the addition of another database instance replicating from Secondary 1.

Mixed chained replication is a setup where Secondary 1 replicates from Primary using the binlog method, and Secondary 2 replicates from Secondary 1 using the GTID method. This is illustrated in the following diagram.

![](/blogs/00/6.png)

To set up this configuration, configure the Primary as you would for simple binlog replication, and then configure Secondary 1 and Secondary 2 as you would for simple GTID replication. Here is the configuration for the Primary instance:

```apache
[mysqld]
server_id = 1
binlog_do_db = database1
```

And here is the configuration for the Secondary 1 and Secondary 2 instances:

```apache
[mysqld]
server_id = <unique id>
gtid_mode = ON
enforce_gtid_consistency = ON
```

The difference lies only in starting the replication from Primary to Secondary 1. Here is the SQL command that needs to be run on the Secondary 1 instance:

```sql
CHANGE REPLICATION SOURCE TO
	ASSIGN_GTIDS_TO_ANONYMOUS_TRANSACTIONS = LOCAL,
	SOURCE_HOST = '<primary host>',
	SOURCE_USER = '<user with replication privilege>',
	SOURCE_PASSWORD = '<password of the user>',
	SOURCE_LOG_FILE = '<binlog name in primary>',
	SOURCE_LOG_POS = <the position in binlog by which to start the replication>;
```

The difference is indeed quite minor, with just the addition of one line: `ASSIGN_GTIDS_TO_ANONYMOUS_TRANSACTIONS = LOCAL`, which instructs MySQL to assign GTIDs to transactions occurring on the Primary instance.

After running this command, replication from Primary to Secondary 1 will start automatically. To start replication from Secondary 1 to Secondary 2, the following command needs to be executed on Secondary 2:

```sql
CHANGE REPLICATION SOURCE TO
    SOURCE_HOST = '<secondary 1 host>',
    SOURCE_USER = '<user with replication privilege>',
    SOURCE_PASSWORD = '<password of the user>',
    SOURCE_AUTO_POSITION = 1;
```

After running the two commands above, the entire setup should be up and running smoothly, ready for testing.

## Group Replication

In this setup, I conducted an exploration involving 3 databases: Primary, Secondary 1, and Secondary 2, where both Secondary 1 and Secondary 2 are replicas of the Primary.

![](/blogs/00/7.png)

The difference between group replication and regular replication lies in the high-availability nature of group replication. In a single-primary cluster mode, Secondary instances in group replication automatically serve only read queries, while mutation queries are handled by the Primary. Additionally, if the Primary instance fails, one of the Secondary instances will automatically be promoted to Primary, ensuring the cluster can continue serving mutation queries. MySQL utilizes the [Paxos Distributed Consensus Algorithm](<https://en.wikipedia.org/wiki/Paxos_(computer_science)>) for managing this cluster.

MySQL group replication also supports multi-primary cluster mode, where there are more than one instance serving mutation queries. However, this mode is not included in the exploration I conducted, so I won't discuss it in this writing.

To run group replication with single-primary cluster mode, a minimum of 3 database instances is required. Here is the configuration for the Primary instance:

```apache
[mysqld]
server_id = 1
gtid_mode = ON
enforce_gtid_consistency = ON
binlog_checksum = NONE
relay_log = primary-relay-bin

plugin_load_add = group_replication.so
loose_group_replication_group_name = aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
loose_group_replication_start_on_boot = OFF
loose_group_replication_local_address = "<primary host>:6606"
loose_group_replication_group_seeds = "<primary host>:6606,<secondary 1 host>:6606,<secondary 2 host>:6606"
loose_group_replication_bootstrap_group = OFF
loose_group_replication_single_primary_mode = ON
loose_group_replication_enforce_update_everywhere_checks = OFF
```

If you notice, above, group replication is performed using the GTID-based replication method. Additionally, there are several additional configurations such as `loose_group_replication_local_address`, which needs to be filled with the value `<primary host>:<desired port>`, and `loose_group_replication_group_seeds`, which needs to be filled with the `<host>:<port>` of all cluster members, up to `loose_group_replication_single_primary_mode`, which is used to determine whether the cluster will run in single-primary or multi-primary mode.

As for the Secondary instances, here is their configuration:

```apache
[mysqld]
server_id = <unique id>
gtid_mode = ON
enforce_gtid_consistency = ON
binlog_checksum = NONE
relay_log = secondary-relay-bin

plugin_load_add = group_replication.so
loose_group_replication_group_name = aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
loose_group_replication_start_on_boot = OFF
loose_group_replication_local_address = "<secondary host>:6606"
loose_group_replication_group_seeds = "<primary host>:6606,<secondary 1 host>:6606,<secondary 2 host>:6606"
loose_group_replication_bootstrap_group = OFF
loose_group_replication_single_primary_mode = ON
loose_group_replication_enforce_update_everywhere_checks = OFF
```

You can see the difference lies only in the values of `server_id` and `loose_group_replication_local_address`; the rest is the same.

To initiate group replication, execute the following command on the Primary:

```sql
SET @@GLOBAL.group_replication_bootstrap_group = ON;
CREATE USER IF NOT EXISTS 'repl'@'%';
GRANT REPLICATION SLAVE ON *.* TO repl@'%';
FLUSH PRIVILEGES;
CHANGE REPLICATION SOURCE TO master_user='repl'
    FOR CHANNEL 'group_replication_recovery';
START GROUP_REPLICATION;
```

The command above will create a new user on the Primary named "repl", and then the Primary instance will bootstrap the group replication cluster.

After running the command above, execute the following command to check if the group replication cluster is running:

```sql
SELECT * FROM performance_schema.replication_group_members;
```

If the group replication cluster has been successfully started, the output should display data as follows:

![](/blogs/00/8.png)

Then, on each Secondary instance, execute the following command:

```sql
CHANGE REPLICATION SOURCE TO master_user='repl'
    FOR CHANNEL 'group_replication_recovery';
START GROUP_REPLICATION;
SET @@global.read_only = 1;
```

Then, run the following command again on one of the cluster members:

```sql
SELECT * FROM performance_schema.replication_group_members;
```

If the Secondary instances have successfully connected to the cluster, the output should look like this:

![](/blogs/00/9.png)

## Testing

The main replication functionality of each setup can be tested with a simple test, which involves running a set of mutation queries on the Primary and then observing whether the results of these queries are reflected in the Secondary instances.

For example, to test whether replication in the setup of simple replication using GTID method is working properly, I can run the following query on the Primary:

```sql
CREATE TABLE users(
    uid VARCHAR(255) NOT NULL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    gender ENUM('Men', 'Women') NOT NULL,
    age INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

Then, you can check on the Secondary instance. If replication is functioning correctly, the same table should appear:

![](/blogs/00/10.png)

### Testing Chained Replications

To test chained replication, you can perform the same test as above, but the checking can be extended to see if the table is also reflected in the Secondary 2 instance. If replication is functioning correctly, the answer should be yes.

![](/blogs/00/11.png)

In addition to the test above, you can also conduct a test by running mutation queries on the Primary instance and then running different mutation queries on the Secondary 1 instance, with the expectation that both will be reflected in the Secondary 2 instance. For that, you can execute the following query on the Primary instance:

```sql
INSERT INTO database1.users (uid, full_name, gender, age)
VALUES
	('One', 'Daniel', 'Men', 22),
	('Two', 'Ishmael', 'Men', 28),
	('Three', 'Elizabeth', 'Women', 26);
```

Then continue by executing the following query on the Secondary 1 instance:

```sql
INSERT INTO database1.users (uid, full_name, gender, age)
VALUES
	('Four', 'Muhammad', 'Men', 40),
	('Five', 'Yahya', 'Men', 33);
```

If replication is working correctly, the Secondary 2 instance should contain 5 rows in the users table, which is a combination of the two queries above:

![](/blogs/00/12.png)

### Testing Group Replication

For additional testing, specifically for group replication, besides conducting basic testing for replication functionality using the testing methods mentioned above, you can also test its highly-available nature by verifying whether its automatic failover works properly.

If the Primary instance is shut down, one of the Secondary instances should automatically be promoted to Primary, as illustrated in the following picture:

![](/blogs/00/13.png)

To reintroduce the Primary instance to the cluster, restart the Primary instance, then execute the following command on that instance:

```sql
CHANGE REPLICATION SOURCE TO master_user='repl' FOR CHANNEL 'group_replication_recovery';
START GROUP_REPLICATION;
```

If successful, the Primary will rejoin the cluster but with the status as a Secondary instance instead of Primary. This is the default behavior in MySQL group replication setup.

![](/blogs/00/14.png)

However, if a mutation query is executed on the Primary instance, it will be rejected because the instance is not the primary instance, thus automatically set as read-only. Here is the query attempted to be executed on the Primary after rejoining the cluster:

```sql
INSERT INTO database1.users (uid, full_name, gender, age)
VALUES
	('Six', 'Khalid', 'Men', 34),
	('Seven', 'Hannibal', 'Men', 38);
```

You should encounter an error like this:

![](/blogs/00/15.png)

But if the query is executed on Secondary 1, which is now the new Primary instance, you shouldn't encounter any error:

![](/blogs/00/16.png)

And the result will also be replicated to the old Primary instance:

![](/blogs/00/17.png)

## End Words

Replication is a crucial concept in modern database systems. With the increasing amount of data handled by modern systems, the need to distribute computational and storage loads from one computer to multiple interconnected computers becomes more crucial.

As a programmer, I believe that understanding the procedures and workings of replication from several commonly used databases holds significant value. This means we have another reference solution to solve problems. I believe the more reference solutions a programmer has in their mind to solve problems, the more opportunities they have to provide greater value and impact. They will have many comparisons and can determine the most optimal solution, resulting in higher-quality delivery.

I also feel the need to write a disclaimer that the exploration I conducted is only intended to gain a general overview of the procedure for replicating using the MySQL database. It is not intended to try every combination of configurations, topologies, and replication modes provided by MySQL. Therefore, there are still many aspects related to replication that I did not cover in this writing. For example, I didn't mention anything about semisynchronous replication and multi-source replication, even though both are supported by MySQL. Therefore I encourage readers to explore the [official MySQL documentation](https://dev.mysql.com/doc/refman/8.3/en/) for a deeper dive.

---

If you're interested in viewing the configuration files and code I used in this exploration, you can visit the following repository:

[danilhendrasr/mysql-replication-experiment](https://github.com/danilhendrasr/mysql-replication-experiment)

You only need Docker Compose to run the experiments I conducted in that repository. I have written guides in each directory explaining how to run and test the setup in that directory.

Happy hacking!
